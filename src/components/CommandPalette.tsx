import { useEffect, useMemo, useRef, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Modal } from "./Modal";
import { useUiStore } from "../lib/uiStore";
import { useDataStore } from "../lib/dataStore";
import { api } from "../lib/tauri";
import { htmlToMarkdown } from "../lib/markdownExport";
import { resolveTheme } from "../lib/theme";
import { COMMANDS } from "../lib/commands";
import { useUpdaterStore } from "../lib/updaterStore";

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void | Promise<void>;
}

export function CommandPalette() {
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const theme = useUiStore((s) => s.theme);
  const setThemeFn = useUiStore((s) => s.setTheme);
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const setActiveNoteId = useUiStore((s) => s.setActiveNoteId);

  const currentNote = useDataStore((s) => s.currentNote);
  const recentNotes = useDataStore((s) => s.recentNotes);
  const openNote = useDataStore((s) => s.openNote);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const close = () => setCommandPaletteOpen(false);

  const commands: Command[] = useMemo(() => {
    // global shortcut-bound commands, straight from the shared registry —
    // keeps the palette, the keydown handler, and Settings' shortcut list in sync
    const list: Command[] = COMMANDS.filter((c) => c.run && c.id !== "command-palette").map((c) => ({
      id: c.id,
      label: c.label,
      hint: c.shortcut?.display,
      run: c.run!,
    }));

    list.push({ id: "settings", label: "Abrir configuración", run: () => setSettingsOpen(true) });
    list.push({
      id: "toggle-theme",
      label: resolveTheme(theme) === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro",
      run: () => setThemeFn(resolveTheme(theme) === "dark" ? "light" : "dark"),
    });
    list.push({
      id: "check-updates",
      label: "Buscar actualizaciones",
      run: () => {
        setSettingsOpen(true);
        useUpdaterStore.getState().checkForUpdates();
      },
    });

    for (const note of recentNotes.slice(0, 6)) {
      if (note.id === currentNote?.id) continue;
      list.push({
        id: `open-${note.id}`,
        label: `Abrir: ${note.title || "Sin título"}`,
        hint: note.subject_name,
        run: async () => {
          setView({ kind: "subject", subjectId: note.subject_id });
          setActiveNoteId(note.id);
          await openNote(note.id);
        },
      });
    }

    if (currentNote) {
      list.push({
        id: "export-md",
        label: "Exportar nota como Markdown",
        run: async () => {
          const path = await save({
            defaultPath: `${currentNote.title || "sin-titulo"}.md`,
            filters: [{ name: "Markdown", extensions: ["md"] }],
          });
          if (path) await api.exportTextFile(path, htmlToMarkdown(currentNote.content));
        },
      });
      list.push({
        id: "export-txt",
        label: "Exportar nota como TXT",
        run: async () => {
          const path = await save({
            defaultPath: `${currentNote.title || "sin-titulo"}.txt`,
            filters: [{ name: "Texto", extensions: ["txt"] }],
          });
          if (path) await api.exportTextFile(path, currentNote.content_text);
        },
      });
      list.push({
        id: "export-pdf",
        label: "Exportar nota como PDF",
        run: () => {
          setCommandPaletteOpen(false);
          window.setTimeout(() => window.print(), 60);
        },
      });
    }

    list.push({
      id: "minimize",
      label: "Minimizar ventana",
      run: () => getCurrentWindow().minimize(),
    });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, theme, currentNote, recentNotes, openNote, setView, setActiveNoteId, setSettingsOpen, setThemeFn, setCommandPaletteOpen]);

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      filtered[activeIndex].run();
      close();
    }
  };

  return (
    <Modal onClose={close}>
      <div className="palette-input-row">
        <span className="palette-prompt">&gt;</span>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Escribí un comando…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="palette-list">
        {filtered.map((cmd, i) => (
          <button
            key={cmd.id}
            className={"palette-item command" + (i === activeIndex ? " active" : "")}
            onMouseEnter={() => setActiveIndex(i)}
            onClick={async () => {
              await cmd.run();
              close();
            }}
          >
            <span>{cmd.label}</span>
            {cmd.hint && <kbd>{cmd.hint}</kbd>}
          </button>
        ))}
        {filtered.length === 0 && <div className="palette-empty">Ningún comando coincide</div>}
      </div>
    </Modal>
  );
}
