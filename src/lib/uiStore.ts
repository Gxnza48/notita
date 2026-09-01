import { create } from "zustand";
import type { ThemePreference } from "./types";
import { applyTheme, getStoredThemePreference, setStoredThemePreference } from "./theme";

export type ViewMode = { kind: "recent" } | { kind: "subject"; subjectId: string };

interface UiState {
  theme: ThemePreference;
  setTheme: (pref: ThemePreference) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;

  focusMode: boolean;
  toggleFocusMode: () => void;
  setFocusMode: (v: boolean) => void;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;

  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;

  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;

  view: ViewMode;
  setView: (v: ViewMode) => void;

  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;

  addingSubject: boolean;
  setAddingSubject: (v: boolean) => void;
}

const initialTheme = getStoredThemePreference();
applyTheme(initialTheme);

if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const current = getStoredThemePreference();
    if (current === "system") applyTheme(current);
  });
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: initialTheme,
  setTheme: (pref) => {
    setStoredThemePreference(pref);
    applyTheme(pref);
    set({ theme: pref });
  },

  sidebarCollapsed: false,
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

  focusMode: false,
  toggleFocusMode: () => set({ focusMode: !get().focusMode }),
  setFocusMode: (v) => set({ focusMode: v }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),

  searchOpen: false,
  setSearchOpen: (v) => set({ searchOpen: v }),

  settingsOpen: false,
  setSettingsOpen: (v) => set({ settingsOpen: v }),

  view: { kind: "recent" },
  setView: (v) => set({ view: v }),

  activeNoteId: null,
  setActiveNoteId: (id) => set({ activeNoteId: id }),

  addingSubject: false,
  setAddingSubject: (v) => set({ addingSubject: v }),
}));
