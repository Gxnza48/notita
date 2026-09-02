import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { api } from "./tauri";
import { insertVoiceSegment, setVoicePartial } from "./voiceBridge";

export type VoiceLanguage = "es" | "en" | "auto";

interface VoiceState {
  modelReady: boolean | null;
  downloading: boolean;
  downloadProgress: number;
  recording: boolean;
  language: VoiceLanguage;
  error: string | null;
  hint: string | null;
  deviceName: string | null;

  checkModelStatus: () => Promise<void>;
  setLanguage: (lang: VoiceLanguage) => void;
  toggleRecording: () => Promise<void>;
}

let listenersArmed = false;

function armListenersOnce() {
  if (listenersArmed) return;
  listenersArmed = true;

  listen<{ downloaded: number; total: number }>("voice-model-progress", (event) => {
    const { downloaded, total } = event.payload;
    useVoiceStore.setState({
      downloadProgress: total > 0 ? Math.round((downloaded / total) * 100) : 0,
    });
  });

  listen<{ text: string }>("voice-final", (event) => {
    insertVoiceSegment(event.payload.text);
  });

  listen<{ text: string }>("voice-partial", (event) => {
    setVoicePartial(event.payload.text);
  });

  listen<string>("voice-error", (event) => {
    setVoicePartial("");
    useVoiceStore.setState({ error: event.payload, recording: false });
  });

  listen<string>("voice-hint", (event) => {
    useVoiceStore.setState({ hint: event.payload });
  });

  listen<{ name: string }>("voice-device", (event) => {
    useVoiceStore.setState({ deviceName: event.payload.name, hint: null });
  });
}

armListenersOnce();

export const useVoiceStore = create<VoiceState>((set, get) => ({
  modelReady: null,
  downloading: false,
  downloadProgress: 0,
  recording: false,
  language: "es",
  error: null,
  hint: null,
  deviceName: null,

  checkModelStatus: async () => {
    try {
      const status = await api.getVoiceModelStatus();
      set({ modelReady: status.ready });
    } catch {
      set({ modelReady: false });
    }
  },

  setLanguage: (language) => set({ language }),

  toggleRecording: async () => {
    const { recording, modelReady, language } = get();
    set({ error: null, hint: null });

    if (recording) {
      set({ recording: false, deviceName: null });
      try {
        await api.stopVoiceRecording();
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    if (!modelReady) {
      set({ downloading: true, downloadProgress: 0 });
      try {
        await api.downloadVoiceModel();
        set({ modelReady: true, downloading: false });
        await api.warmUpVoiceModel();
      } catch (e) {
        set({ downloading: false, error: e instanceof Error ? e.message : String(e) });
        return;
      }
    }

    try {
      await api.startVoiceRecording(language);
      set({ recording: true });
    } catch (e) {
      set({ recording: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
}));
