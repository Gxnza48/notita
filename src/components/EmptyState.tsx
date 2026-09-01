import { useEffect, useState } from "react";
import { useDataStore } from "../lib/dataStore";
import { useUiStore } from "../lib/uiStore";
import { api } from "../lib/tauri";
import type { SubjectOverview } from "../lib/types";

export function EmptyState() {
  const view = useUiStore((s) => s.view);
  const setActiveNoteId = useUiStore((s) => s.setActiveNoteId);
  const subjects = useDataStore((s) => s.subjects);
  const createNote = useDataStore((s) => s.createNote);
  const notesBySubject = useDataStore((s) => s.notesBySubject);

  const [overview, setOverview] = useState<SubjectOverview | null>(null);

  const subjectId = view.kind === "subject" ? view.subjectId : undefined;
  const hasNotes = subjectId ? (notesBySubject[subjectId]?.length ?? 0) > 0 : false;

  useEffect(() => {
    if (!subjectId) {
      setOverview(null);
      return;
    }
    let cancelled = false;
    api.getSubjectOverview(subjectId).then((result) => {
      if (!cancelled) setOverview(result);
    });
    return () => {
      cancelled = true;
    };
  }, [subjectId, hasNotes]);

  const handleCreate = async () => {
    const targetSubjectId = subjectId ?? subjects[0]?.id;
    if (!targetSubjectId) return;
    const note = await createNote(targetSubjectId);
    setActiveNoteId(note.id);
  };

  if (overview) {
    return (
      <div className="empty-state">
        <p className="subject-overview-name">{overview.subject.name}</p>
        <div className="subject-overview-stats">
          <div className="subject-overview-stat">
            <span className="subject-overview-value">{overview.note_count}</span>
            <span className="subject-overview-label">notes</span>
          </div>
          <div className="subject-overview-stat">
            <span className="subject-overview-value">{overview.concept_count}</span>
            <span className="subject-overview-label">concepts</span>
          </div>
          <div className="subject-overview-stat">
            <span className="subject-overview-value">{overview.question_count}</span>
            <span className="subject-overview-label">questions</span>
          </div>
          <div className="subject-overview-stat">
            <span className="subject-overview-value">{overview.task_count}</span>
            <span className="subject-overview-label">tasks</span>
          </div>
        </div>
        <button className="text-btn empty-state-cta" onClick={handleCreate}>
          + New note
        </button>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <p className="empty-state-title">No notes yet.</p>
      <p className="empty-state-subtitle">Start writing something worth remembering.</p>
      <button className="text-btn empty-state-cta" onClick={handleCreate}>
        + New note
      </button>
    </div>
  );
}
