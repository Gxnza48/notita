import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "./components/Sidebar";
import { Editor } from "./components/Editor";
import { EmptyState } from "./components/EmptyState";
import { Onboarding } from "./components/Onboarding";
import { CommandPalette } from "./components/CommandPalette";
import { SearchModal } from "./components/SearchModal";
import { SettingsPanel } from "./components/SettingsPanel";
import { UpdateBanner } from "./components/UpdateBanner";
import { useDataStore } from "./lib/dataStore";
import { useUiStore } from "./lib/uiStore";
import { useSettingsStore } from "./lib/settingsStore";
import { useUpdaterStore } from "./lib/updaterStore";
import { NOTE_CREATED_EVENT, type NoteCreatedPayload } from "./lib/events";
import { COMMANDS, matchesShortcut } from "./lib/commands";
import { applyWindowTheme } from "./lib/windowTheme";

export default function App() {
  const ready = useDataStore((s) => s.ready);
  const subjects = useDataStore((s) => s.subjects);
  const currentNote = useDataStore((s) => s.currentNote);

  const commandPaletteOpen = useUiStore((s) => s.commandPaletteOpen);
  const searchOpen = useUiStore((s) => s.searchOpen);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const focusMode = useUiStore((s) => s.focusMode);
  const theme = useUiStore((s) => s.theme);
  const setFocusMode = useUiStore((s) => s.setFocusMode);
  const setActiveNoteId = useUiStore((s) => s.setActiveNoteId);
  const setView = useUiStore((s) => s.setView);

  useEffect(() => {
    applyWindowTheme(theme);
  }, [theme]);

  const [bootError, setBootError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);

  useEffect(() => {
    async function boot() {
      try {
        setBootError(null);
        await useDataStore.getState().loadAll();
        await useSettingsStore.getState().load();
        const { recentNotes } = useDataStore.getState();
        const { openLastNote } = useSettingsStore.getState();
        if (openLastNote && recentNotes.length > 0) {
          const latest = recentNotes[0];
          setView({ kind: "subject", subjectId: latest.subject_id });
          setActiveNoteId(latest.id);
          await useDataStore.getState().openNote(latest.id);
        }
      } catch (e) {
        // Without this, a failed initial load (e.g. a transient SQLite lock)
        // left the app stuck forever on an empty div — indistinguishable
        // from a frozen black screen.
        setBootError(e instanceof Error ? e.message : String(e));
      }
    }
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootAttempt]);

  // Nothing else triggers an update check automatically — without this, a
  // user can sit on an old, already-fixed-elsewhere build indefinitely
  // unless they happen to open Settings and click "Check for updates".
  useEffect(() => {
    useUpdaterStore.getState().checkForUpdates();
  }, []);

  useEffect(() => {
    const unlistenPromise = listen<NoteCreatedPayload>(NOTE_CREATED_EVENT, (event) => {
      useDataStore.getState().loadRecentNotes();
      const subjectId = event.payload.subjectId;
      if (subjectId in useDataStore.getState().notesBySubject) {
        useDataStore.getState().loadNotesForSubject(subjectId);
      }
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const anyModalOpen =
        useUiStore.getState().commandPaletteOpen ||
        useUiStore.getState().searchOpen ||
        useUiStore.getState().settingsOpen;

      for (const cmd of COMMANDS) {
        if (!cmd.shortcut || !cmd.run) continue;
        if (!matchesShortcut(e, cmd.shortcut)) continue;
        if (cmd.skipWhenModalOpen && anyModalOpen) return;
        e.preventDefault();
        cmd.run();
        return;
      }

      if (e.key === "Escape" && useUiStore.getState().focusMode && !anyModalOpen) {
        setFocusMode(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setFocusMode]);

  if (bootError) {
    return (
      <div className="crash-screen">
        <p className="crash-title">Couldn't load your notes.</p>
        <p className="crash-message">{bootError}</p>
        <button className="crash-reload" onClick={() => setBootAttempt((n) => n + 1)}>
          Retry
        </button>
      </div>
    );
  }

  if (!ready) {
    return <div className="notita-app" />;
  }

  if (subjects.length === 0) {
    return <Onboarding />;
  }

  return (
    <div className="notita-app">
      {!focusMode && <Sidebar />}
      <main className="notita-main">{currentNote ? <Editor /> : <EmptyState />}</main>
      {commandPaletteOpen && <CommandPalette />}
      {searchOpen && <SearchModal />}
      {settingsOpen && <SettingsPanel />}
      <UpdateBanner />
    </div>
  );
}
