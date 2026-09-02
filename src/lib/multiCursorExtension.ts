import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

interface MultiCursorState {
  secondaries: number[];
}

const multiCursorKey = new PluginKey<MultiCursorState>("multiCursor");

function clamp(pos: number, size: number): number {
  return Math.max(0, Math.min(size, pos));
}

/**
 * Applies `mutate` at every active cursor (all secondaries + the primary
 * selection head) within a single transaction, processed from the highest
 * document position to the lowest so an edit never invalidates the
 * still-to-be-edited *positions* of the points after it in the loop.
 *
 * That alone isn't enough, though: `mutate` returns each point's new
 * position as of right after ITS OWN edit — but a point processed earlier
 * (at a higher position) can still be shifted by a point processed LATER
 * (at a lower position, e.g. an earlier line growing), since inserting
 * before something always pushes it forward. So each result is recorded
 * together with how many steps existed at the time, then remapped through
 * only the steps added AFTER it (`tr.mapping.slice(afterStepIndex)`) once
 * every edit is in. Skipping this is what caused v1's "types backwards"
 * bug: naive `pos + text.length` arithmetic went stale the moment a
 * different cursor's edit landed earlier in the document.
 */
function applyAtAllCursors(view: EditorView, mutate: (tr: Transaction, pos: number) => number): boolean {
  const st = multiCursorKey.getState(view.state);
  if (!st || st.secondaries.length === 0) return false;

  const primaryHead = view.state.selection.head;
  const positions = Array.from(new Set([...st.secondaries, primaryHead])).sort((a, b) => b - a);

  const tr = view.state.tr;
  const rawByOriginal = new Map<number, { pos: number; afterStepIndex: number }>();
  for (const pos of positions) {
    const newPos = mutate(tr, pos);
    rawByOriginal.set(pos, { pos: newPos, afterStepIndex: tr.mapping.maps.length });
  }

  const size = tr.doc.content.size;
  const finalByOriginal = new Map<number, number>();
  for (const [orig, { pos, afterStepIndex }] of rawByOriginal) {
    finalByOriginal.set(orig, clamp(tr.mapping.slice(afterStepIndex).map(pos), size));
  }

  const newPrimary = finalByOriginal.get(primaryHead)!;
  const newSecondaries = positions.filter((p) => p !== primaryHead).map((p) => finalByOriginal.get(p)!);

  tr.setSelection(TextSelection.near(tr.doc.resolve(newPrimary)));
  tr.setMeta(multiCursorKey, newSecondaries);
  view.dispatch(tr);
  return true;
}

/** Same remap-through-later-steps fix as `applyAtAllCursors`, specialized for text input since the primary cursor may carry a real (from,to) range while secondaries are always collapsed points. */
function applyInsertText(view: EditorView, from: number, to: number, text: string): boolean {
  const st = multiCursorKey.getState(view.state);
  if (!st || st.secondaries.length === 0) return false;

  const primaryHead = view.state.selection.head;
  const points = [
    { key: primaryHead, from, to },
    ...st.secondaries.map((p) => ({ key: p, from: p, to: p })),
  ].sort((a, b) => b.from - a.from);

  const tr = view.state.tr;
  const rawByKey = new Map<number, { pos: number; afterStepIndex: number }>();
  for (const pt of points) {
    tr.insertText(text, pt.from, pt.to);
    rawByKey.set(pt.key, { pos: pt.from + text.length, afterStepIndex: tr.mapping.maps.length });
  }

  const size = tr.doc.content.size;
  const finalByKey = new Map<number, number>();
  for (const [key, { pos, afterStepIndex }] of rawByKey) {
    finalByKey.set(key, clamp(tr.mapping.slice(afterStepIndex).map(pos), size));
  }

  const newPrimary = finalByKey.get(primaryHead)!;
  const newSecondaries = st.secondaries.map((p) => finalByKey.get(p)!);

  tr.setSelection(TextSelection.near(tr.doc.resolve(newPrimary)));
  tr.setMeta(multiCursorKey, newSecondaries);
  view.dispatch(tr);
  return true;
}

function applyMove(view: EditorView, delta: number): boolean {
  const st = multiCursorKey.getState(view.state);
  if (!st || st.secondaries.length === 0) return false;

  const primaryHead = view.state.selection.head;
  const positions = Array.from(new Set([...st.secondaries, primaryHead]));
  const size = view.state.doc.content.size;
  const moved = positions.map((p) => clamp(p + delta, size));

  const primaryIndex = positions.indexOf(primaryHead);
  const newPrimary = moved[primaryIndex];
  const newSecondaries = moved.filter((_, i) => i !== primaryIndex);

  const tr = view.state.tr;
  tr.setSelection(TextSelection.near(tr.doc.resolve(newPrimary)));
  tr.setMeta(multiCursorKey, newSecondaries);
  view.dispatch(tr);
  return true;
}

/**
 * VS Code-style Alt+Click multi-cursor. ProseMirror has no native concept
 * of multiple selections, so this keeps one REAL selection (the primary —
 * an ordinary native caret) plus an array of "secondary" positions tracked
 * in plugin state and rendered as fake blinking carets via decorations.
 * Typing, Backspace, Delete, and Enter get intercepted and replicated at
 * every position in one transaction (so undo reverts them all together);
 * Left/Right move every cursor together. Up/Down and multi-range paste are
 * intentionally out of scope — they fall through to normal single-cursor
 * behavior. Whenever there are no secondary cursors (the overwhelming
 * common case), every handler below returns `false` immediately and
 * ProseMirror/Tiptap behaves exactly as it did before this extension.
 */
export const MultiCursor = Extension.create({
  name: "multiCursor",

  addProseMirrorPlugins() {
    return [
      new Plugin<MultiCursorState>({
        key: multiCursorKey,

        state: {
          init: () => ({ secondaries: [] }),
          apply(tr, prev) {
            const meta = tr.getMeta(multiCursorKey);
            if (meta !== undefined) return { secondaries: meta };
            if (tr.docChanged) return { secondaries: prev.secondaries.map((p) => tr.mapping.map(p)) };
            return prev;
          },
        },

        props: {
          decorations(state) {
            const st = multiCursorKey.getState(state);
            if (!st || st.secondaries.length === 0) return null;
            const decos = st.secondaries.map((pos) =>
              Decoration.widget(
                pos,
                () => {
                  const el = document.createElement("span");
                  el.className = "multi-cursor-caret";
                  return el;
                },
                { side: 0, key: `mc-${pos}` },
              ),
            );
            return DecorationSet.create(state.doc, decos);
          },

          handleDOMEvents: {
            mousedown(view, event) {
              const mouseEvent = event as MouseEvent;
              if (!mouseEvent.altKey) {
                const st = multiCursorKey.getState(view.state);
                if (st && st.secondaries.length > 0) {
                  view.dispatch(view.state.tr.setMeta(multiCursorKey, []));
                }
                return false;
              }
              const coords = view.posAtCoords({ left: mouseEvent.clientX, top: mouseEvent.clientY });
              if (!coords) return false;
              mouseEvent.preventDefault();

              const st = multiCursorKey.getState(view.state) ?? { secondaries: [] };
              const primaryHead = view.state.selection.head;
              const newSecondaries = Array.from(new Set([...st.secondaries, primaryHead])).filter(
                (p) => p !== coords.pos,
              );
              const tr = view.state.tr
                .setSelection(TextSelection.near(view.state.doc.resolve(coords.pos)))
                .setMeta(multiCursorKey, newSecondaries);
              view.dispatch(tr);
              view.focus();
              return true;
            },
          },

          handleKeyDown(view, event) {
            const st = multiCursorKey.getState(view.state);
            if (!st || st.secondaries.length === 0) return false;

            if (event.key === "Escape") {
              view.dispatch(view.state.tr.setMeta(multiCursorKey, []));
              return true;
            }
            if (event.key === "Backspace") {
              event.preventDefault();
              return applyAtAllCursors(view, (tr, pos) => {
                if (pos <= 0) return pos;
                tr.delete(pos - 1, pos);
                return pos - 1;
              });
            }
            if (event.key === "Delete") {
              event.preventDefault();
              return applyAtAllCursors(view, (tr, pos) => {
                const end = Math.min(pos + 1, tr.doc.content.size);
                if (end > pos) tr.delete(pos, end);
                return pos;
              });
            }
            if (event.key === "Enter") {
              event.preventDefault();
              return applyAtAllCursors(view, (tr, pos) => {
                const before = tr.mapping.maps.length;
                tr.split(pos);
                return tr.mapping.slice(before).map(pos, 1);
              });
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              return applyMove(view, -1);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              return applyMove(view, 1);
            }
            return false;
          },

          handleTextInput(view, from, to, text) {
            return applyInsertText(view, from, to, text);
          },
        },
      }),
    ];
  },
});
