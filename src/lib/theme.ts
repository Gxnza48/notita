import type { ThemePreference } from "./types";

const STORAGE_KEY = "notita-theme-preference";

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "dark" || v === "light" || v === "system") return v;
  return "system";
}

export function setStoredThemePreference(pref: ThemePreference) {
  window.localStorage.setItem(STORAGE_KEY, pref);
}

export function resolveTheme(pref: ThemePreference): "dark" | "light" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}

export function applyTheme(pref: ThemePreference) {
  const resolved = resolveTheme(pref);
  document.documentElement.setAttribute("data-theme", resolved);
}
