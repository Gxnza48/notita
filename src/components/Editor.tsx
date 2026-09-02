import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
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
import { CopyNoteButton } from "./CopyNoteButton";
import { registerEditorFlush } from "../lib/editorBridge";
import { registerVoiceInsertHandler, registerVoicePartialHandler } from "../lib/voiceBridge";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";

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
        placeholder: ({ node }) => (node.type.name === "paragraph" ? "Empezá a escribir algo que valga la pena recordar…" : ""),
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Underline,
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

  // The effect above only re-syncs `title` when the note ID changes —
  // renaming the CURRENTLY open note (e.g. from the sidebar's context
  // menu) updates currentNote.title without switching notes, and was
  // previously left stuck showing the old title in this input.
  useEffect(() => {
    if (currentNote && noteIdRef.current === currentNote.id) {
      setTitle(currentNote.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNote?.title]);

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

  // Right-click a text selection for a Word/Docs-style formatting menu.
  // With nothing selected, the native context menu still shows as before.
  const [formatMenu, setFormatMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handler = (e: MouseEvent) => {
      if (editor.state.selection.empty) return;
      e.preventDefault();
      setFormatMenu({ x: e.clientX, y: e.clientY });
    };
    dom.addEventListener("contextmenu", handler);
    return () => dom.removeEventListener("contextmenu", handler);
  }, [editor]);

  const formatMenuItems: ContextMenuItem[] = editor
    ? [
        { id: "bold", label: "Negrita", checked: editor.isActive("bold"), onSelect: () => editor.chain().focus().toggleBold().run() },
        { id: "italic", label: "Cursiva", checked: editor.isActive("italic"), onSelect: () => editor.chain().focus().toggleItalic().run() },
        {
          id: "underline",
          label: "Subrayado",
          checked: editor.isActive("underline"),
          onSelect: () => editor.chain().focus().toggleUnderline().run(),
        },
        {
          id: "strike",
          label: "Tachado",
          checked: editor.isActive("strike"),
          onSelect: () => editor.chain().focus().toggleStrike().run(),
        },
        { id: "code", label: "Código", checked: editor.isActive("code"), onSelect: () => editor.chain().focus().toggleCode().run() },
      ]
    : [];

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
          <div className="editor-topbar-right">
            <span className="editor-clock">{clock}</span>
            <CopyNoteButton editor={editor} />
          </div>
        </div>
      )}
      <div className="editor-scroll">
        <div className="editor-page">
          <input
            className="note-title-input"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            placeholder="Sin título"
            aria-label="Título de la nota"
          />
          <EditorContent editor={editor} />
        </div>
      </div>
      <WpmBadge />
      <VoiceButton />
      {formatMenu && (
        <ContextMenu position={formatMenu} items={formatMenuItems} onClose={() => setFormatMenu(null)} />
      )}
    </div>
  );
}
