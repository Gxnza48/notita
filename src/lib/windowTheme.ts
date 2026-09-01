import { invoke } from "@tauri-apps/api/core";
import { resolveTheme } from "./theme";
import type { ThemePreference } from "./types";

/** Syncs the native Windows title bar (DWM immersive dark mode) with notita's theme. */
export function applyWindowTheme(pref: ThemePreference) {
  const resolved = resolveTheme(pref);
  invoke("set_window_theme", { theme: resolved }).catch(() => {
    // best-effort — older Windows builds without immersive dark mode support
  });
}
