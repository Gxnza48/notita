import { create } from "zustand";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdaterStatus = "idle" | "checking" | "up-to-date" | "available" | "downloading" | "ready" | "error";

interface UpdaterState {
  status: UpdaterStatus;
  latestVersion: string | null;
  notes: string | null;
  progress: number;
  errorMessage: string | null;
  pendingUpdate: Update | null;

  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  status: "idle",
  latestVersion: null,
  notes: null,
  progress: 0,
  errorMessage: null,
  pendingUpdate: null,

  checkForUpdates: async () => {
    set({ status: "checking", errorMessage: null });
    try {
      const update = await check();
      if (update) {
        set({ status: "available", latestVersion: update.version, notes: update.body ?? null, pendingUpdate: update });
      } else {
        set({ status: "up-to-date", pendingUpdate: null });
      }
    } catch (e) {
      set({ status: "error", errorMessage: e instanceof Error ? e.message : String(e) });
    }
  },

  installUpdate: async () => {
    const update = get().pendingUpdate;
    if (!update) return;
    set({ status: "downloading", progress: 0 });
    try {
      let totalBytes = 0;
      let downloadedBytes = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          totalBytes = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          const pct = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
          set({ progress: pct });
        } else if (event.event === "Finished") {
          set({ progress: 100 });
        }
      });
      set({ status: "ready" });
      await relaunch();
    } catch (e) {
      set({ status: "error", errorMessage: e instanceof Error ? e.message : String(e) });
    }
  },
}));
