import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useUiStore } from "./uiStore";
import { useDataStore } from "./dataStore";
import { flushEditor } from "./editorBridge";
import { useVoiceStore } from "./voiceStore";

export type CommandCategory = "General" | "Notes" | "Navigation" | "Windows";

export interface ShortcutKey {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  /** Matched against KeyboardEvent.key (case-insensitive). */
  key?: string;
  /** Matched against KeyboardEvent.code — needed for keys like Space. */
  code?: string;
  /** Human-readable form shown in the palette and Settings. */
  display: string;
}

export interface CommandDefinition {
  id: string;
  label: string;
  category: CommandCategory;
  shortcut?: ShortcutKey;
  /** Runs the command. Absent for entries that are display-only (handled elsewhere, e.g. Escape closing whichever modal is open). */
  run?: () => void | Promise<void>;
  /** Skip firing this command's global shortcut while a modal is open. */
  skipWhenModalOpen?: boolean;
}

async function runNewNote() {
  const { view } = useUiStore.getState();
  const { subjects, createNote } = useDataStore.getState();
  const subjectId = view.kind === "subject" ? view.subjectId : subjects[0]?.id;
  if (!subjectId) return;
  const note = await createNote(subjectId);
  useUiStore.getState().setActiveNoteId(note.id);
}

async function runQuickCapture() {
  const win = await WebviewWindow.getByLabel("quick-capture");
  await win?.center();
  await win?.show();
  await win?.setFocus();
}

/**
 * Single source of truth for every global, always-available command that has
 * a real keyboard shortcut. Used by the App-level keydown handler, the
 * Command Palette, and the Settings "Keyboard Shortcuts" list — so the three
 * can never drift out of sync.
 */
export const COMMANDS: CommandDefinition[] = [
  {
    id: "new-note",
    label: "New note",
    category: "Notes",
    shortcut: { ctrl: true, key: "n", display: "Ctrl N" },
    run: runNewNote,
    skipWhenModalOpen: true,
  },
  {
    id: "new-subject",
    label: "New subject",
    category: "Notes",
    shortcut: { ctrl: true, shift: true, key: "n", display: "Ctrl Shift N" },
    run: () => {
      useUiStore.getState().setSidebarCollapsed(false);
      useUiStore.getState().setAddingSubject(true);
    },
  },
  {
    id: "search",
    label: "Search notes",
    category: "Navigation",
    shortcut: { ctrl: true, key: "k", display: "Ctrl K" },
    run: () => useUiStore.getState().setSearchOpen(true),
  },
  {
    id: "command-palette",
    label: "Command palette",
    category: "General",
    shortcut: { ctrl: true, key: "p", display: "Ctrl P" },
    run: () => useUiStore.getState().setCommandPaletteOpen(true),
  },
  {
    id: "save",
    label: "Save",
    category: "General",
    shortcut: { ctrl: true, key: "s", display: "Ctrl S" },
    run: () => flushEditor(),
  },
  {
    id: "focus-mode",
    label: "Toggle Focus Mode",
    category: "General",
    shortcut: { key: "F11", display: "F11" },
    run: () => useUiStore.getState().toggleFocusMode(),
  },
  {
    id: "quick-capture",
    label: "Quick Capture",
    category: "Windows",
    shortcut: { ctrl: true, alt: true, code: "Space", display: "Ctrl Alt Space" },
    run: runQuickCapture,
  },
  {
    id: "voice-note",
    label: "Voice note",
    category: "Notes",
    shortcut: { ctrl: true, shift: true, key: "v", display: "Ctrl Shift V" },
    run: () => useVoiceStore.getState().toggleRecording(),
  },
  {
    id: "close-modal",
    label: "Close modal",
    category: "General",
    shortcut: { key: "Escape", display: "Esc" },
    // Each modal closes itself on Escape (see Modal.tsx) — listed here only
    // so Settings' shortcut list and the palette stay accurate.
  },
];

export function matchesShortcut(e: KeyboardEvent, s: ShortcutKey): boolean {
  const mod = e.ctrlKey || e.metaKey;
  if (!!s.ctrl !== mod) return false;
  if (!!s.alt !== e.altKey) return false;
  if (!!s.shift !== e.shiftKey) return false;
  if (s.code) return e.code === s.code;
  if (s.key) return e.key.toLowerCase() === s.key.toLowerCase();
  return false;
}
