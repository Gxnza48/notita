import { create } from "zustand";
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";
import { api } from "./tauri";

interface SettingsState {
  fontSize: number;
  lineHeight: number;
  openLastNote: boolean;
  startWithWindows: boolean;
  closeToTray: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  setFontSize: (v: number) => void;
  setLineHeight: (v: number) => void;
  setOpenLastNote: (v: boolean) => void;
  setStartWithWindows: (v: boolean) => Promise<void>;
  setCloseToTray: (v: boolean) => void;
}

function applyEditorVars(fontSize: number, lineHeight: number) {
  document.documentElement.style.setProperty("--editor-font-size", `${fontSize}px`);
  document.documentElement.style.setProperty("--editor-line-height", `${lineHeight}`);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  fontSize: 17,
  lineHeight: 1.7,
  openLastNote: true,
  startWithWindows: false,
  closeToTray: true,
  loaded: false,

  load: async () => {
    const [fontSize, lineHeight, openLastNote, closeToTray, autostart] = await Promise.all([
      api.getSetting("editor.fontSize"),
      api.getSetting("editor.lineHeight"),
      api.getSetting("behavior.openLastNote"),
      api.getSetting("behavior.closeToTray"),
      isAutostartEnabled().catch(() => false),
    ]);
    const next = {
      fontSize: fontSize ? Number(fontSize) : get().fontSize,
      lineHeight: lineHeight ? Number(lineHeight) : get().lineHeight,
      openLastNote: openLastNote !== null ? openLastNote === "true" : get().openLastNote,
      closeToTray: closeToTray !== null ? closeToTray === "true" : get().closeToTray,
      startWithWindows: autostart,
      loaded: true,
    };
    applyEditorVars(next.fontSize, next.lineHeight);
    set(next);
  },

  setFontSize: (v) => {
    applyEditorVars(v, get().lineHeight);
    set({ fontSize: v });
    api.setSetting("editor.fontSize", String(v));
  },

  setLineHeight: (v) => {
    applyEditorVars(get().fontSize, v);
    set({ lineHeight: v });
    api.setSetting("editor.lineHeight", String(v));
  },

  setOpenLastNote: (v) => {
    set({ openLastNote: v });
    api.setSetting("behavior.openLastNote", String(v));
  },

  setCloseToTray: (v) => {
    set({ closeToTray: v });
    api.setSetting("behavior.closeToTray", String(v));
  },

  setStartWithWindows: async (v) => {
    try {
      if (v) await enableAutostart();
      else await disableAutostart();
      set({ startWithWindows: v });
    } catch {
      // ignore if unsupported in this environment
    }
  },
}));
