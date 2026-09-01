import { invoke } from "@tauri-apps/api/core";
import type {
  Note,
  NoteSummary,
  SaveNotePayload,
  SearchHit,
  SessionStats,
  Subject,
  SubjectOverview,
  WpmRecord,
} from "./types";

export const api = {
  listSubjects: () => invoke<Subject[]>("list_subjects"),
  createSubject: (name: string) => invoke<Subject>("create_subject", { name }),
  renameSubject: (id: string, name: string) => invoke<void>("rename_subject", { id, name }),
  deleteSubject: (id: string) => invoke<void>("delete_subject", { id }),
  getSubjectOverview: (id: string) => invoke<SubjectOverview>("get_subject_overview", { id }),

  listRecentNotes: (limit = 20) => invoke<NoteSummary[]>("list_recent_notes", { limit }),
  listNotesBySubject: (subjectId: string) =>
    invoke<NoteSummary[]>("list_notes_by_subject", { subjectId }),
  getNote: (id: string) => invoke<Note>("get_note", { id }),
  createNote: (subjectId: string, title?: string) =>
    invoke<Note>("create_note", { subjectId, title: title ?? null }),
  renameNote: (id: string, title: string) => invoke<void>("rename_note", { id, title }),
  duplicateNote: (id: string) => invoke<Note>("duplicate_note", { id }),
  saveNote: (payload: SaveNotePayload) => invoke<void>("save_note", { payload }),
  deleteNote: (id: string) => invoke<void>("delete_note", { id }),
  togglePinned: (id: string) => invoke<boolean>("toggle_pinned", { id }),

  searchNotes: (query: string) => invoke<SearchHit[]>("search_notes", { query }),

  getSetting: (key: string) => invoke<string | null>("get_setting", { key }),
  setSetting: (key: string, value: string) => invoke<void>("set_setting", { key, value }),

  recordWpmSample: (noteId: string | null, subjectId: string | null, wpm: number, charCount: number) =>
    invoke<void>("record_wpm_sample", { noteId, subjectId, wpm, charCount }),
  getBestWpm: () => invoke<WpmRecord | null>("get_best_wpm"),
  getSessionStats: (sinceMs: number) => invoke<SessionStats>("get_session_stats", { sinceMs }),

  exportTextFile: (path: string, contents: string) =>
    invoke<void>("export_text_file", { path, contents }),

  getVoiceModelStatus: () => invoke<{ ready: boolean }>("get_voice_model_status"),
  downloadVoiceModel: () => invoke<void>("download_voice_model"),
  warmUpVoiceModel: () => invoke<void>("warm_up_voice_model"),
  startVoiceRecording: (language: string) => invoke<void>("start_voice_recording", { language }),
  stopVoiceRecording: () => invoke<void>("stop_voice_recording"),
};
