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
 * document position to the lowest. An edit at a higher position can only
 * ever affect content at or above its own start — never below it — so a
 * not-yet-processed lower position stays valid without needing to remap it
 * through the steps already added. `mutate` returns the new position for
 * whatever point it was given.
 */
function applyAtAllCursors(view: EditorView, mutate: (tr: Transaction, pos: number) => number): boolean {
  const st = multiCursorKey.getState(view.state);
  if (!st || st.secondaries.length === 0) return false;

  const primaryHead = view.state.selection.head;
  const positions = Array.from(new Set([...st.secondaries, primaryHead])).sort((a, b) => b - a);

  const tr = view.state.tr;
  const resultByOriginal = new Map<number, number>();
  for (const pos of positions) {
    resultByOriginal.set(pos, mutate(tr, pos));
  }

  const size = tr.doc.content.size;
  const newPrimary = clamp(resultByOriginal.get(primaryHead)!, size);
  const newSecondaries = positions.filter((p) => p !== primaryHead).map((p) => clamp(resultByOriginal.get(p)!, size));

  tr.setSelection(TextSelection.near(tr.doc.resolve(newPrimary)));
  tr.setMeta(multiCursorKey, newSecondaries);
  view.dispatch(tr);
  return true;
}

function applyInsertText(view: EditorView, from: number, to: number, text: string): boolean {
  const st = multiCursorKey.getState(view.state);
  if (!st || st.secondaries.length === 0) return false;

  const primaryHead = view.state.selection.head;
  const points = [
    { key: primaryHead, from, to },
    ...st.secondaries.map((p) => ({ key: p, from: p, to: p })),
  ].sort((a, b) => b.from - a.from);

  const tr = view.state.tr;
  const resultByKey = new Map<number, number>();
  for (const pt of points) {
    tr.insertText(text, pt.from, pt.to);
    resultByKey.set(pt.key, pt.from + text.length);
  }

  const size = tr.doc.content.size;
  const newPrimary = clamp(resultByKey.get(primaryHead)!, size);
  const newSecondaries = st.secondaries.map((p) => clamp(resultByKey.get(p)!, size));

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
