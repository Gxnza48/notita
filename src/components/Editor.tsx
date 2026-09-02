import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { MarkerParagraph } from "../lib/markerExtension";
import { CodeBlockWithCopy } from "../lib/codeBlockExtension";
import { VoicePartialMark } from "../lib/voicePartialExtension";
import { MultiCursor } from "../lib/multiCursorExtension";
import { analyzeDoc } from "../lib/markers";
import { useDataStore } from "../lib/dataStore";
import { useUiStore } from "../lib/uiStore";
import { engine, setWpmContext } from "../lib/wpmStore";
import type { SaveNotePayload } from "../lib/types";
import { WpmBadge } from "./WpmBadge";
import { VoiceButton } from "./VoiceButton";
import { registerEditorFlush } from "../lib/editorBridge";
import { registerVoiceInsertHandler, registerVoicePartialHandler } from "../lib/voiceBridge";

const SAVE_DEBOUNCE_MS = 500;

function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Editor() {
  const currentNote = useDataStore((s) => s.currentNote);
  const subjects = useDataStore((s) => s.subjects);
  const patchCurrentNote = useDataStore((s) => s.patchCurrentNote);
  const persistCurrentNote = useDataStore((s) => s.persistCurrentNote);
  const focusMode = useUiStore((s) => s.focusMode);

  const [title, setTitle] = useState(currentNote?.title ?? "");
  const [clock, setClock] = useState(() => formatClock(new Date()));
  const lastTextLength = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const noteIdRef = useRef<string | null>(null);

  const subject = subjects.find((s) => s.id === currentNote?.subject_id);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ paragraph: false, codeBlock: false }),
      MarkerParagraph,
      CodeBlockWithCopy,
      VoicePartialMark,
      MultiCursor,
      Placeholder.configure({
        placeholder: ({ node }) => (node.type.name === "paragraph" ? "Start writing something worth remembering…" : ""),
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: "",
    autofocus: "end",
    editorProps: {
      attributes: {
        class: "notita-editor-content",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      const delta = text.length - lastTextLength.current;
      lastTextLength.current = text.length;
      if (delta > 0) engine.recordDelta(delta);
      else engine.recordDelta(0);
      scheduleSave();
    },
  });

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      flushSave();
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const flushSave = useCallback(() => {
    if (!editor || !noteIdRef.current) return;
    const json = editor.getJSON();
    const analysis = analyzeDoc(json);
    const payload: SaveNotePayload = {
      id: noteIdRef.current,
      title,
      content: editor.getHTML(),
      content_text: analysis.contentText,
      concept_count: analysis.conceptCount,
      tasks: analysis.tasks,
      questions: analysis.questions,
      important: analysis.important,
    };
    persistCurrentNote(payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, title, persistCurrentNote]);

  const flushSaveRef = useRef(flushSave);
  flushSaveRef.current = flushSave;

  // load note content when switching notes
  useEffect(() => {
    if (!editor || !currentNote) return;
    if (noteIdRef.current === currentNote.id) return;

    // flush any pending save for the previous note before switching, so a
    // fast note-switch never silently drops the last debounced edit
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
      flushSaveRef.current();
    }

    noteIdRef.current = currentNote.id;
    setTitle(currentNote.title);
    editor.commands.setContent(currentNote.content || "", false);
    lastTextLength.current = editor.getText().length;
    // Note: session WPM stats (average/peak/chars) intentionally persist
    // across note switches — a "session" is this sitting, not a single note.
    setWpmContext(currentNote.id, currentNote.subject_id);
  }, [editor, currentNote]);

  // flush on true unmount (app closing / editor pane closing)
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        flushSaveRef.current();
      }
    };
  }, []);

  // let global shortcuts (Ctrl+S) force an immediate save
  useEffect(() => {
    registerEditorFlush(() => flushSaveRef.current());
    return () => registerEditorFlush(null);
  }, []);

  // Live voice dictation: `voice-partial` repeatedly replaces a single
  // tracked range of visually-muted (VoicePartialMark) text at the cursor —
  // never appended, always replaced in place — so the sentence-so-far
  // appears to grow while the user is still talking. `voice-final` swaps
  // that range for plain confirmed text. Transactions are dispatched
  // directly (not through the Tiptap chain API) so they can be marked
  // `addToHistory: false` — a partial update firing every ~600ms shouldn't
  // spam undo history.
  const partialRangeRef = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (!editor) return;

    const applyPartial = (text: string) => {
      const { state, view } = editor;
      const range = partialRangeRef.current;
      try {
        if (!text) {
          if (range) {
            const tr = state.tr.delete(range.from, range.to);
            tr.setMeta("addToHistory", false);
            view.dispatch(tr);
          }
          partialRangeRef.current = null;
          return;
        }
        const tr = state.tr;
        const from = range ? range.from : state.selection.to;
        tr.insertText(text, from, range ? range.to : from);
        const to = from + text.length;
        tr.addMark(from, to, state.schema.marks.voicePartial.create());
        tr.setMeta("addToHistory", false);
        view.dispatch(tr);
        partialRangeRef.current = { from, to };
      } catch {
        // Stale range (e.g. the user edited elsewhere mid-dictation) —
        // drop this update rather than throw; the next one recovers.
        partialRangeRef.current = null;
      }
    };

    const applyFinal = (text: string) => {
      const { state, view } = editor;
      const range = partialRangeRef.current;
      partialRangeRef.current = null;
      const content = `${text} `;
      try {
        const tr = state.tr;
        const from = range ? range.from : state.selection.to;
        tr.insertText(content, from, range ? range.to : from);
        const to = from + content.length;
        tr.removeMark(from, to, state.schema.marks.voicePartial);
        tr.setSelection(TextSelection.create(tr.doc, to));
        view.dispatch(tr);
        view.focus();
      } catch {
        editor.chain().focus().insertContent(content).run();
      }
    };

    registerVoicePartialHandler(applyPartial);
    registerVoiceInsertHandler(applyFinal);
    return () => {
      registerVoicePartialHandler(null);
      registerVoiceInsertHandler(null);
      partialRangeRef.current = null;
    };
  }, [editor]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatClock(new Date())), 15000);
    return () => window.clearInterval(id);
  }, []);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    patchCurrentNote({ title: value });
    scheduleSave();
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      editor?.commands.focus("start");
    }
  };

  if (!currentNote) return null;

  return (
    <div className={"editor-pane" + (focusMode ? " focus-mode" : "")}>
      {!focusMode && (
        <div className="editor-topbar">
          <span className="editor-subject">{subject?.name ?? ""}</span>
          <span className="editor-clock">{clock}</span>
        </div>
      )}
      <div className="editor-scroll">
        <div className="editor-page">
          <input
            className="note-title-input"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            placeholder="Untitled"
            aria-label="Note title"
          />
          <EditorContent editor={editor} />
        </div>
      </div>
      <WpmBadge />
      <VoiceButton />
    </div>
  );
}
