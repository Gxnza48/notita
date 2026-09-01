import { create } from "zustand";
import { api } from "./tauri";
import type { Note, NoteSummary, SaveNotePayload, Subject } from "./types";

interface DataState {
  subjects: Subject[];
  recentNotes: NoteSummary[];
  notesBySubject: Record<string, NoteSummary[]>;
  currentNote: Note | null;
  loadingNote: boolean;
  ready: boolean;

  loadAll: () => Promise<void>;
  loadRecentNotes: () => Promise<void>;
  loadNotesForSubject: (subjectId: string) => Promise<void>;

  createSubject: (name: string) => Promise<Subject>;
  renameSubject: (id: string, name: string) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;

  createNote: (subjectId: string, title?: string) => Promise<Note>;
  renameNote: (id: string, title: string, subjectId: string) => Promise<void>;
  duplicateNote: (id: string, subjectId: string) => Promise<Note>;
  openNote: (id: string) => Promise<void>;
  closeNote: () => void;
  patchCurrentNote: (patch: Partial<Note>) => void;
  persistCurrentNote: (payload: SaveNotePayload) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  togglePinned: (id: string) => Promise<void>;
}

export const useDataStore = create<DataState>((set, get) => ({
  subjects: [],
  recentNotes: [],
  notesBySubject: {},
  currentNote: null,
  loadingNote: false,
  ready: false,

  loadAll: async () => {
    const [subjects, recentNotes] = await Promise.all([api.listSubjects(), api.listRecentNotes(30)]);
    set({ subjects, recentNotes, ready: true });
  },

  loadRecentNotes: async () => {
    const recentNotes = await api.listRecentNotes(30);
    set({ recentNotes });
  },

  loadNotesForSubject: async (subjectId) => {
    const notes = await api.listNotesBySubject(subjectId);
    set({ notesBySubject: { ...get().notesBySubject, [subjectId]: notes } });
  },

  createSubject: async (name) => {
    const subject = await api.createSubject(name);
    set({ subjects: [...get().subjects, subject] });
    return subject;
  },

  renameSubject: async (id, name) => {
    await api.renameSubject(id, name);
    set({ subjects: get().subjects.map((s) => (s.id === id ? { ...s, name } : s)) });
  },

  deleteSubject: async (id) => {
    await api.deleteSubject(id);
    const { [id]: _removed, ...rest } = get().notesBySubject;
    set({
      subjects: get().subjects.filter((s) => s.id !== id),
      notesBySubject: rest,
      recentNotes: get().recentNotes.filter((n) => n.subject_id !== id),
    });
  },

  createNote: async (subjectId, title) => {
    const note = await api.createNote(subjectId, title);
    set({ currentNote: note });
    await Promise.all([get().loadRecentNotes(), get().loadNotesForSubject(subjectId)]);
    return note;
  },

  renameNote: async (id, title, subjectId) => {
    await api.renameNote(id, title);
    const current = get().currentNote;
    if (current?.id === id) set({ currentNote: { ...current, title, updated_at: Date.now() } });
    await Promise.all([get().loadRecentNotes(), get().loadNotesForSubject(subjectId)]);
  },

  duplicateNote: async (id, subjectId) => {
    const note = await api.duplicateNote(id);
    await Promise.all([get().loadRecentNotes(), get().loadNotesForSubject(subjectId)]);
    return note;
  },

  openNote: async (id) => {
    set({ loadingNote: true });
    try {
      const note = await api.getNote(id);
      set({ currentNote: note, loadingNote: false });
    } catch (e) {
      set({ loadingNote: false });
      throw e;
    }
  },

  closeNote: () => set({ currentNote: null }),

  patchCurrentNote: (patch) => {
    const current = get().currentNote;
    if (!current) return;
    set({ currentNote: { ...current, ...patch } });
  },

  persistCurrentNote: async (payload) => {
    await api.saveNote(payload);
    const current = get().currentNote;
    if (!current || current.id !== payload.id) return;
    const updated: Note = {
      ...current,
      title: payload.title,
      content: payload.content,
      content_text: payload.content_text,
      concept_count: payload.concept_count,
      updated_at: Date.now(),
    };
    set({ currentNote: updated });
    await Promise.all([get().loadRecentNotes(), get().loadNotesForSubject(updated.subject_id)]);
  },

  deleteNote: async (id) => {
    const note = get().currentNote;
    await api.deleteNote(id);
    set({
      recentNotes: get().recentNotes.filter((n) => n.id !== id),
      notesBySubject: Object.fromEntries(
        Object.entries(get().notesBySubject).map(([k, v]) => [k, v.filter((n) => n.id !== id)]),
      ),
      currentNote: note?.id === id ? null : note,
    });
  },

  togglePinned: async (id) => {
    const pinned = await api.togglePinned(id);
    const patch = (n: NoteSummary) => (n.id === id ? { ...n, pinned } : n);
    set({
      recentNotes: get().recentNotes.map(patch),
      notesBySubject: Object.fromEntries(
        Object.entries(get().notesBySubject).map(([k, v]) => [k, v.map(patch)]),
      ),
    });
  },
}));
