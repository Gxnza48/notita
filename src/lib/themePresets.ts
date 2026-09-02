export type ColorScheme = "light" | "dark";

export interface ThemeSeed {
  id: string;
  name: string;
  bg: string;
  fg: string;
  accent: string;
  warm: string;
  task: string;
  scheme: ColorScheme;
}

const TOKEN_KEYS = [
  "--bg",
  "--fg",
  "--fg-secondary",
  "--fg-tertiary",
  "--fg-quaternary",
  "--border",
  "--border-strong",
  "--surface",
  "--surface-hover",
  "--surface-active",
  "--accent",
  "--accent-fg",
  "--accent-soft",
  "--warm",
  "--warm-soft",
  "--task",
  "--task-soft",
  "--scrollbar",
  "--shadow-color",
] as const;

export type ThemeTokens = Record<(typeof TOKEN_KEYS)[number], string>;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function schemeForBg(bg: string): ColorScheme {
  return relativeLuminance(bg) < 0.5 ? "dark" : "light";
}

/** Picks readable black-or-white text for any accent hex, for use as --accent-fg. */
function contrastFg(hex: string): string {
  return relativeLuminance(hex) > 0.45 ? "#001018" : "#ffffff";
}

/**
 * Expands a small color seed (bg/fg/accent/warm/task) into the full token
 * set the app's CSS actually consumes, using the same opacity ratios as the
 * hand-authored light/dark palettes in theme.css — so a 5-color preset
 * still gets correctly-graduated secondary text, borders, surfaces, etc.
 */
export function deriveTokens(seed: Pick<ThemeSeed, "bg" | "fg" | "accent" | "warm" | "task">): ThemeTokens {
  const { bg, fg, accent, warm, task } = seed;
  const dark = relativeLuminance(bg) < 0.5;
  return {
    "--bg": bg,
    "--fg": fg,
    "--fg-secondary": rgba(fg, dark ? 0.62 : 0.58),
    "--fg-tertiary": rgba(fg, dark ? 0.4 : 0.36),
    "--fg-quaternary": rgba(fg, dark ? 0.22 : 0.2),
    "--border": rgba(fg, 0.1),
    "--border-strong": rgba(fg, 0.18),
    "--surface": rgba(fg, dark ? 0.045 : 0.035),
    "--surface-hover": rgba(fg, dark ? 0.07 : 0.055),
    "--surface-active": rgba(fg, dark ? 0.1 : 0.08),
    "--accent": accent,
    "--accent-fg": contrastFg(accent),
    "--accent-soft": rgba(accent, dark ? 0.16 : 0.12),
    "--warm": warm,
    "--warm-soft": rgba(warm, dark ? 0.14 : 0.1),
    "--task": task,
    "--task-soft": rgba(task, dark ? 0.14 : 0.1),
    "--scrollbar": rgba(fg, dark ? 0.16 : 0.14),
    "--shadow-color": dark ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.12)",
  };
}

export function applyThemeTokens(tokens: ThemeTokens) {
  const root = document.documentElement.style;
  for (const key of TOKEN_KEYS) root.setProperty(key, tokens[key]);
}

export function clearThemeTokens() {
  const root = document.documentElement.style;
  for (const key of TOKEN_KEYS) root.removeProperty(key);
}

export const THEME_PRESETS: ThemeSeed[] = [
  { id: "midnight-blue", name: "Midnight Blue", bg: "#0b1120", fg: "#e2e8f0", accent: "#60a5fa", warm: "#f87171", task: "#34d399", scheme: "dark" },
  { id: "nord", name: "Nord", bg: "#2e3440", fg: "#eceff4", accent: "#88c0d0", warm: "#bf616a", task: "#a3be8c", scheme: "dark" },
  { id: "dracula", name: "Dracula", bg: "#282a36", fg: "#f8f8f2", accent: "#bd93f9", warm: "#ff5555", task: "#50fa7b", scheme: "dark" },
  { id: "gruvbox-dark", name: "Gruvbox Dark", bg: "#282828", fg: "#ebdbb2", accent: "#fabd2f", warm: "#fb4934", task: "#b8bb26", scheme: "dark" },
  { id: "solarized-dark", name: "Solarized Dark", bg: "#002b36", fg: "#93a1a1", accent: "#268bd2", warm: "#dc322f", task: "#859900", scheme: "dark" },
  { id: "tokyo-night", name: "Tokyo Night", bg: "#1a1b26", fg: "#c0caf5", accent: "#7aa2f7", warm: "#f7768e", task: "#9ece6a", scheme: "dark" },
  { id: "rose-pine", name: "Rosé Pine", bg: "#191724", fg: "#e0def4", accent: "#ebbcba", warm: "#eb6f92", task: "#9ccfd8", scheme: "dark" },
  { id: "catppuccin-mocha", name: "Catppuccin Mocha", bg: "#1e1e2e", fg: "#cdd6f4", accent: "#89b4fa", warm: "#f38ba8", task: "#a6e3a1", scheme: "dark" },
  { id: "forest", name: "Forest", bg: "#0f1a13", fg: "#d7e4d9", accent: "#4ade80", warm: "#f59e0b", task: "#22c55e", scheme: "dark" },
  { id: "plum", name: "Plum", bg: "#1a1023", fg: "#ecdff5", accent: "#c084fc", warm: "#f472b6", task: "#5eead4", scheme: "dark" },
  { id: "amber-noir", name: "Amber Noir", bg: "#141210", fg: "#f2e9dc", accent: "#f0a94e", warm: "#e0562b", task: "#8fae5c", scheme: "dark" },
  { id: "slate", name: "Slate", bg: "#111827", fg: "#e5e7eb", accent: "#38bdf8", warm: "#fb7185", task: "#4ade80", scheme: "dark" },
  { id: "paper", name: "Paper", bg: "#faf6ee", fg: "#2b2620", accent: "#b45309", warm: "#c2410c", task: "#15803d", scheme: "light" },
  { id: "sepia", name: "Sepia", bg: "#f4ecd8", fg: "#43341f", accent: "#a16207", warm: "#b45309", task: "#4d7c0f", scheme: "light" },
  { id: "arctic", name: "Arctic", bg: "#f8fafc", fg: "#1e293b", accent: "#0284c7", warm: "#e11d48", task: "#059669", scheme: "light" },
  { id: "rose-quartz", name: "Rose Quartz", bg: "#fdf2f8", fg: "#3b1526", accent: "#db2777", warm: "#dc2626", task: "#0891b2", scheme: "light" },
  { id: "sage", name: "Sage", bg: "#f4f7f0", fg: "#26301f", accent: "#4d7c0f", warm: "#c2410c", task: "#0f766e", scheme: "light" },
  { id: "lavender", name: "Lavender", bg: "#f7f5ff", fg: "#2a2540", accent: "#7c3aed", warm: "#e11d48", task: "#0d9488", scheme: "light" },
  { id: "sand", name: "Sand", bg: "#f6f1e9", fg: "#332b1f", accent: "#c2703d", warm: "#b91c1c", task: "#3f6212", scheme: "light" },
  { id: "mint", name: "Mint", bg: "#f0fdf9", fg: "#0f2e26", accent: "#0d9488", warm: "#e11d48", task: "#65a30d", scheme: "light" },
];
