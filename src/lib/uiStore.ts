import { create } from "zustand";
import type { ThemePreference } from "./types";
import { applyTheme, getStoredThemePreference, setStoredThemePreference } from "./theme";
import { applyWindowTheme, applyWindowScheme } from "./windowTheme";
import {
  applyPresetSelection,
  applyFontSelection,
  applySelectionColor,
  getStoredPresetId,
  setStoredPresetId,
  getStoredCustomColors,
  setStoredCustomColors,
  getStoredFontId,
  setStoredFontId,
  getStoredSelectionColor,
  setStoredSelectionColor,
  schemeForPresetSelection,
  type CustomColors,
} from "./themeCustomization";

export type ViewMode = { kind: "recent" } | { kind: "subject"; subjectId: string };

interface UiState {
  theme: ThemePreference;
  setTheme: (pref: ThemePreference) => void;

  themePresetId: string;
  customColors: CustomColors | null;
  fontId: string;
  selectionColor: string | null;
  setThemePresetId: (id: string) => void;
  setCustomColors: (colors: CustomColors) => void;
  setFontId: (id: string) => void;
  setSelectionColor: (hex: string | null) => void;

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

const initialPresetId = getStoredPresetId();
const initialCustomColors = getStoredCustomColors();
const initialFontId = getStoredFontId();
const initialSelectionColor = getStoredSelectionColor();
applyPresetSelection(initialPresetId, initialCustomColors);
applyFontSelection(initialFontId);
applySelectionColor(initialSelectionColor);

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

  themePresetId: initialPresetId,
  customColors: initialCustomColors,
  fontId: initialFontId,
  selectionColor: initialSelectionColor,

  setThemePresetId: (id) => {
    setStoredPresetId(id);
    applyPresetSelection(id, get().customColors);
    const scheme = id === "default" ? null : schemeForPresetSelection(id, get().customColors);
    if (scheme) applyWindowScheme(scheme);
    else applyWindowTheme(get().theme);
    set({ themePresetId: id });
  },

  setCustomColors: (colors) => {
    setStoredCustomColors(colors);
    set({ customColors: colors });
    if (get().themePresetId === "custom") {
      applyPresetSelection("custom", colors);
      const scheme = schemeForPresetSelection("custom", colors);
      if (scheme) applyWindowScheme(scheme);
    }
  },

  setFontId: (id) => {
    setStoredFontId(id);
    applyFontSelection(id);
    set({ fontId: id });
  },

  setSelectionColor: (hex) => {
    setStoredSelectionColor(hex);
    applySelectionColor(hex);
    set({ selectionColor: hex });
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
