import { create } from "zustand";
import { WpmEngine, type WpmSnapshot } from "./wpmEngine";
import { api } from "./tauri";

/** Marks the start of this "session" — session stats are since app launch. */
const SESSION_START_MS = Date.now();

interface WpmState extends WpmSnapshot {
  bestWpm: number;
  sessionAverage: number;
  sessionPeak: number;
  sessionChars: number;
  refreshBest: () => Promise<void>;
  refreshSessionStats: () => Promise<void>;
}

let currentNoteId: string | null = null;
let currentSubjectId: string | null = null;

export const engine = new WpmEngine((wpm, chars) => {
  api.recordWpmSample(currentNoteId, currentSubjectId, wpm, chars).catch(() => {});
  const best = useWpmStore.getState().bestWpm;
  if (wpm > best) useWpmStore.setState({ bestWpm: wpm });
});

export function setWpmContext(noteId: string | null, subjectId: string | null) {
  currentNoteId = noteId;
  currentSubjectId = subjectId;
}

export const useWpmStore = create<WpmState>((set) => {
  engine.subscribe((snapshot) => set(snapshot));
  return {
    visible: false,
    wpm: 0,
    bestWpm: 0,
    sessionAverage: 0,
    sessionPeak: 0,
    sessionChars: 0,
    refreshBest: async () => {
      const record = await api.getBestWpm();
      if (record) set({ bestWpm: record.wpm });
    },
    refreshSessionStats: async () => {
      const stats = await api.getSessionStats(SESSION_START_MS);
      set({ sessionAverage: stats.average, sessionPeak: stats.peak, sessionChars: stats.total_chars });
    },
  };
});
