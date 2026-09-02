import { invoke } from "@tauri-apps/api/core";
import { resolveTheme } from "./theme";
import type { ThemePreference } from "./types";

/** Syncs the native Windows title bar (DWM immersive dark mode) with notita's theme. */
export function applyWindowTheme(pref: ThemePreference) {
  applyWindowScheme(resolveTheme(pref));
}

/** Same as `applyWindowTheme`, but for a resolved scheme directly — used when a theme preset (which fixes its own scheme) is active instead of the System/Dark/Light preference. */
export function applyWindowScheme(scheme: "dark" | "light") {
  invoke("set_window_theme", { theme: scheme }).catch(() => {
    // best-effort — older Windows builds without immersive dark mode support
  });
}
