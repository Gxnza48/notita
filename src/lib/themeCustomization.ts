import { applyThemeTokens, clearThemeTokens, deriveTokens, rgba, schemeForBg, THEME_PRESETS, type ColorScheme } from "./themePresets";
import { fontStackFor, DEFAULT_FONT_ID } from "./fontOptions";

export interface CustomColors {
  bg: string;
  fg: string;
  accent: string;
}

const PRESET_KEY = "notita-theme-preset-id"; // "default" | "custom" | a THEME_PRESETS id
const CUSTOM_KEY = "notita-theme-custom-colors";
const FONT_KEY = "notita-font-id";
const SELECTION_KEY = "notita-selection-color";

export function getStoredPresetId(): string {
  if (typeof window === "undefined") return "default";
  return window.localStorage.getItem(PRESET_KEY) ?? "default";
}

export function setStoredPresetId(id: string) {
  window.localStorage.setItem(PRESET_KEY, id);
}

export function getStoredCustomColors(): CustomColors | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CUSTOM_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.bg === "string" && typeof parsed?.fg === "string" && typeof parsed?.accent === "string") {
      return parsed;
    }
  } catch {
    // fall through
  }
  return null;
}

export function setStoredCustomColors(colors: CustomColors) {
  window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(colors));
}

export function getStoredFontId(): string {
  if (typeof window === "undefined") return DEFAULT_FONT_ID;
  return window.localStorage.getItem(FONT_KEY) ?? DEFAULT_FONT_ID;
}

export function setStoredFontId(id: string) {
  window.localStorage.setItem(FONT_KEY, id);
}

/** Returns the resolved dark/light scheme a non-"default" preset selection implies, for syncing the native title bar. */
export function schemeForPresetSelection(presetId: string, customColors: CustomColors | null): ColorScheme | null {
  if (presetId === "custom") return customColors ? schemeForBg(customColors.bg) : null;
  const preset = THEME_PRESETS.find((p) => p.id === presetId);
  return preset?.scheme ?? null;
}

/** Applies (or clears, for "default") the CSS variable overrides for the given preset selection. */
export function applyPresetSelection(presetId: string, customColors: CustomColors | null) {
  if (presetId === "default") {
    clearThemeTokens();
    return;
  }
  if (presetId === "custom") {
    if (!customColors) {
      clearThemeTokens();
      return;
    }
    const scheme = schemeForBg(customColors.bg);
    const fallback = THEME_PRESETS.find((p) => p.scheme === scheme);
    applyThemeTokens(
      deriveTokens({
        ...customColors,
        warm: fallback?.warm ?? (scheme === "dark" ? "#ff7a5c" : "#c9401f"),
        task: fallback?.task ?? (scheme === "dark" ? "#5fd99a" : "#1f7a4d"),
      }),
    );
    return;
  }
  const preset = THEME_PRESETS.find((p) => p.id === presetId);
  if (preset) applyThemeTokens(deriveTokens(preset));
  else clearThemeTokens();
}

export function applyFontSelection(fontId: string) {
  document.documentElement.style.setProperty("--font-sans", fontStackFor(fontId));
}

export function getStoredSelectionColor(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SELECTION_KEY);
}

export function setStoredSelectionColor(hex: string | null) {
  if (hex) window.localStorage.setItem(SELECTION_KEY, hex);
  else window.localStorage.removeItem(SELECTION_KEY);
}

/** `hex` is a plain color; the actual `::selection` background is a soft tint of it (like --accent-soft) so selected text stays readable. `null` reverts to the theme's own accent tint. */
export function applySelectionColor(hex: string | null) {
  if (hex) document.documentElement.style.setProperty("--selection-bg", rgba(hex, 0.32));
  else document.documentElement.style.removeProperty("--selection-bg");
}
