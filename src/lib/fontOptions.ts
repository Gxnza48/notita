export interface FontOption {
  id: string;
  label: string;
  stack: string;
}

// "geist" and "inter" are bundled webfonts (offline-safe); the rest are
// fonts that ship with Windows 11, so picking them adds no download and no
// installer weight.
export const FONT_OPTIONS: FontOption[] = [
  { id: "geist", label: "Geist Sans", stack: '"Geist Sans", "Inter", "Segoe UI", system-ui, -apple-system, sans-serif' },
  { id: "inter", label: "Inter", stack: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif' },
  { id: "segoe", label: "Segoe UI", stack: '"Segoe UI", system-ui, -apple-system, sans-serif' },
  { id: "verdana", label: "Verdana", stack: 'Verdana, "Segoe UI", sans-serif' },
  { id: "calibri", label: "Calibri", stack: 'Calibri, "Segoe UI", sans-serif' },
  { id: "georgia", label: "Georgia", stack: 'Georgia, Cambria, "Times New Roman", serif' },
  { id: "cambria", label: "Cambria", stack: 'Cambria, Georgia, serif' },
  { id: "consolas", label: "Consolas", stack: '"Consolas", "Cascadia Code", ui-monospace, monospace' },
];

export const DEFAULT_FONT_ID = "geist";

export function fontStackFor(id: string): string {
  return FONT_OPTIONS.find((f) => f.id === id)?.stack ?? FONT_OPTIONS[0].stack;
}
