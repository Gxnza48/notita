import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";
import { api } from "./lib/tauri";
import { NOTE_CREATED_EVENT } from "./lib/events";

const win = getCurrentWindow();

export default function QuickCaptureApp() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const targetSubjectId = useRef<string | null>(null);

  const focusInput = () => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const len = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(len, len);
    });
  };

  useEffect(() => {
    focusInput();
    window.addEventListener("focus", focusInput);
    return () => window.removeEventListener("focus", focusInput);
  }, []);

  const resolveTargetSubject = async (): Promise<string | null> => {
    if (targetSubjectId.current) return targetSubjectId.current;
    try {
      const recent = await api.listRecentNotes(1);
      if (recent[0]) {
        targetSubjectId.current = recent[0].subject_id;
        return targetSubjectId.current;
      }
      const subjects = await api.listSubjects();
      if (subjects[0]) {
        targetSubjectId.current = subjects[0].id;
        return targetSubjectId.current;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const save = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) {
      await win.hide();
      return;
    }
    setBusy(true);
    try {
      const subjectId = await resolveTargetSubject();
      if (subjectId) {
        const note = await api.createNote(subjectId);
        const firstLine = trimmed.split("\n")[0].slice(0, 80);
        await api.saveNote({
          id: note.id,
          title: firstLine,
          content: trimmed
            .split("\n")
            .map((line) => `<p>${escapeHtml(line)}</p>`)
            .join(""),
          content_text: trimmed,
          concept_count: 0,
          tasks: [],
          questions: [],
          important: [],
        });
        await emit(NOTE_CREATED_EVENT, { subjectId });
      }
      setText("");
    } finally {
      setBusy(false);
      await win.hide();
    }
  };

  const discard = async () => {
    await win.hide();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      discard();
    }
  };

  return (
    <div className="quick-capture" onBlur={() => text.trim() && save()}>
      <div className="quick-capture-label">Quick note</div>
      <textarea
        ref={textareaRef}
        className="quick-capture-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type something worth remembering…"
        rows={2}
      />
      <div className="quick-capture-hint">
        <kbd>Enter</kbd> save · <kbd>Esc</kbd> discard
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
