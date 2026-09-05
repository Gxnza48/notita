import { useEffect, useRef, useState } from "react";
import { useDataStore } from "../lib/dataStore";
import { useUiStore } from "../lib/uiStore";
import { ThemeToggle } from "./ThemeToggle";
import { ContextMenu, type ContextMenuItem, type ContextMenuPosition } from "./ContextMenu";
import { ConfirmDialog } from "./ConfirmDialog";
import { Tooltip } from "./Tooltip";
import { PlusIcon, SearchIcon, ChevronIcon, GearIcon, TrashIcon } from "./icons";
import type { NoteSummary } from "../lib/types";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(ms).toLocaleDateString("es-419", { month: "short", day: "numeric" });
}

type Target = { kind: "note"; note: NoteSummary } | { kind: "subject"; id: string; name: string };

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const activeNoteId = useUiStore((s) => s.activeNoteId);
  const setActiveNoteId = useUiStore((s) => s.setActiveNoteId);
  const addingSubject = useUiStore((s) => s.addingSubject);
  const setAddingSubject = useUiStore((s) => s.setAddingSubject);

  const subjects = useDataStore((s) => s.subjects);
  const recentNotes = useDataStore((s) => s.recentNotes);
  const notesBySubject = useDataStore((s) => s.notesBySubject);
  const currentNote = useDataStore((s) => s.currentNote);
  const createNote = useDataStore((s) => s.createNote);
  const createSubject = useDataStore((s) => s.createSubject);
  const renameSubject = useDataStore((s) => s.renameSubject);
  const renameNote = useDataStore((s) => s.renameNote);
  const duplicateNote = useDataStore((s) => s.duplicateNote);
  const loadNotesForSubject = useDataStore((s) => s.loadNotesForSubject);
  const openNote = useDataStore((s) => s.openNote);
  const deleteNote = useDataStore((s) => s.deleteNote);
  const deleteSubject = useDataStore((s) => s.deleteSubject);

  const [newSubjectName, setNewSubjectName] = useState("");
  const [contextMenu, setContextMenu] = useState<{ position: ContextMenuPosition; target: Target } | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Target | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  useEffect(() => {
    if (view.kind === "subject") loadNotesForSubject(view.subjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const handleSelectNote = async (id: string) => {
    if (activeNoteId === id && currentNote?.id === id) return;
    setActiveNoteId(id);
    await openNote(id);
  };

  const handleNewNote = async () => {
    const subjectId = view.kind === "subject" ? view.subjectId : subjects[0]?.id;
    if (!subjectId) return;
    const note = await createNote(subjectId);
    setActiveNoteId(note.id);
  };

  const handleDuplicateNote = async (note: NoteSummary) => {
    const copy = await duplicateNote(note.id, note.subject_id);
    setView({ kind: "subject", subjectId: note.subject_id });
    setActiveNoteId(copy.id);
    await openNote(copy.id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    if (confirmTarget.kind === "note") {
      if (activeNoteId === confirmTarget.note.id) setActiveNoteId(null);
      await deleteNote(confirmTarget.note.id);
    } else {
      if (view.kind === "subject" && view.subjectId === confirmTarget.id) setView({ kind: "recent" });
      if (notesBySubject[confirmTarget.id]?.some((n) => n.id === activeNoteId)) setActiveNoteId(null);
      await deleteSubject(confirmTarget.id);
    }
    setConfirmTarget(null);
  };

  const handleCreateSubject = async () => {
    const name = newSubjectName.trim();
    if (!name) {
      setAddingSubject(false);
      return;
    }
    const subject = await createSubject(name);
    setNewSubjectName("");
    setAddingSubject(false);
    setView({ kind: "subject", subjectId: subject.id });
  };

  const openNoteMenu = (e: React.MouseEvent, note: NoteSummary) => {
    e.preventDefault();
    setContextMenu({ position: { x: e.clientX, y: e.clientY }, target: { kind: "note", note } });
  };
  const openSubjectMenu = (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    setContextMenu({ position: { x: e.clientX, y: e.clientY }, target: { kind: "subject", id, name } });
  };

  const noteMenuItems = (note: NoteSummary): ContextMenuItem[] => [
    { id: "open", label: "Abrir", onSelect: () => handleSelectNote(note.id) },
    { id: "rename", label: "Renombrar", onSelect: () => setRenamingId(note.id) },
    { id: "duplicate", label: "Duplicar", onSelect: () => handleDuplicateNote(note) },
    {
      id: "delete",
      label: "Eliminar",
      destructive: true,
      separatorBefore: true,
      onSelect: () => setConfirmTarget({ kind: "note", note }),
    },
  ];
  const subjectMenuItems = (id: string, name: string): ContextMenuItem[] => [
    { id: "rename", label: "Renombrar", onSelect: () => setRenamingId(id) },
    {
      id: "delete",
      label: "Eliminar",
      destructive: true,
      separatorBefore: true,
      onSelect: () => setConfirmTarget({ kind: "subject", id, name }),
    },
  ];

  if (collapsed) {
    return (
      <div className="sidebar collapsed">
        <Tooltip label="Expandir barra lateral">
          <button className="icon-btn" onClick={toggleSidebar} aria-label="Expandir barra lateral">
            <ChevronIcon dir="right" />
          </button>
        </Tooltip>
        <Tooltip label="Nueva nota (Ctrl N)">
          <button className="icon-btn" onClick={handleNewNote} aria-label="Nueva nota">
            <PlusIcon />
          </button>
        </Tooltip>
        <Tooltip label="Buscar (Ctrl K)">
          <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="Buscar">
            <SearchIcon />
          </button>
        </Tooltip>
      </div>
    );
  }

  const activeSubjectNotes = view.kind === "subject" ? notesBySubject[view.subjectId] ?? [] : [];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="brand">
          notita<span className="brand-dot">.</span>
        </span>
        <Tooltip label="Contraer barra lateral">
          <button className="icon-btn" onClick={toggleSidebar} aria-label="Contraer barra lateral">
            <ChevronIcon dir="left" />
          </button>
        </Tooltip>
      </div>

      <div className="sidebar-actions">
        <button className="text-btn sidebar-action" onClick={handleNewNote}>
          <PlusIcon /> Nueva nota
        </button>
        <button className="text-btn sidebar-action" onClick={() => setSearchOpen(true)}>
          <SearchIcon /> Buscar
          <kbd className="sidebar-kbd">Ctrl K</kbd>
        </button>
      </div>

      <div className="sidebar-scroll">
        {recentNotes.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Recientes</div>
            <button
              className={"sidebar-row" + (view.kind === "recent" ? " active" : "")}
              onClick={() => setView({ kind: "recent" })}
            >
              Todas las notas recientes
            </button>
            {recentNotes.slice(0, 6).map((n) => (
              <NoteRow
                key={n.id}
                note={n}
                active={activeNoteId === n.id}
                renaming={renamingId === n.id}
                onSelect={() => handleSelectNote(n.id)}
                onDeleteRequest={() => setConfirmTarget({ kind: "note", note: n })}
                onContextMenu={(e) => openNoteMenu(e, n)}
                onStartRename={() => setRenamingId(n.id)}
                onSubmitRename={(title) => {
                  setRenamingId(null);
                  const clean = title.trim();
                  if (clean !== n.title) renameNote(n.id, clean, n.subject_id);
                }}
                onCancelRename={() => setRenamingId(null)}
              />
            ))}
          </div>
        )}

        <div className="sidebar-section">
          <div className="sidebar-section-title">
            Materias
            <Tooltip label="Nueva materia (Ctrl Shift N)">
              <button className="icon-btn tiny" onClick={() => setAddingSubject(true)} aria-label="Nueva materia">
                <PlusIcon />
              </button>
            </Tooltip>
          </div>
          {subjects.map((s) => (
            <div key={s.id} className="sidebar-row-group">
              <div
                className={"sidebar-row subject-row" + (view.kind === "subject" && view.subjectId === s.id ? " active" : "")}
                onContextMenu={(e) => openSubjectMenu(e, s.id, s.name)}
              >
                {renamingId === s.id ? (
                  <InlineRenameInput
                    initialValue={s.name}
                    className="row-main row-rename-input"
                    onSubmit={(name) => {
                      setRenamingId(null);
                      if (name.trim() && name !== s.name) renameSubject(s.id, name.trim());
                    }}
                    onCancel={() => setRenamingId(null)}
                  />
                ) : (
                  <button
                    className="row-main"
                    onClick={() => setView({ kind: "subject", subjectId: s.id })}
                    onDoubleClick={() => setRenamingId(s.id)}
                  >
                    <span className="note-row-title">{s.name}</span>
                  </button>
                )}
                <Tooltip label="Eliminar materia">
                  <button
                    className="row-delete"
                    aria-label={`Eliminar ${s.name}`}
                    onClick={() => setConfirmTarget({ kind: "subject", id: s.id, name: s.name })}
                  >
                    <TrashIcon />
                  </button>
                </Tooltip>
              </div>
              {view.kind === "subject" && view.subjectId === s.id && (
                <div className="sidebar-subrows">
                  {activeSubjectNotes.map((n) => (
                    <NoteRow
                      key={n.id}
                      note={n}
                      sub
                      active={activeNoteId === n.id}
                      renaming={renamingId === n.id}
                      onSelect={() => handleSelectNote(n.id)}
                      onDeleteRequest={() => setConfirmTarget({ kind: "note", note: n })}
                      onContextMenu={(e) => openNoteMenu(e, n)}
                      onStartRename={() => setRenamingId(n.id)}
                      onSubmitRename={(title) => {
                        setRenamingId(null);
                        const clean = title.trim();
                        if (clean !== n.title) renameNote(n.id, clean, n.subject_id);
                      }}
                      onCancelRename={() => setRenamingId(null)}
                    />
                  ))}
                  {activeSubjectNotes.length === 0 && <div className="sidebar-empty-hint">Todavía no hay notas</div>}
                </div>
              )}
            </div>
          ))}
          {addingSubject && (
            <input
              autoFocus
              className="sidebar-new-subject-input"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              onBlur={handleCreateSubject}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateSubject();
                if (e.key === "Escape") {
                  setAddingSubject(false);
                  setNewSubjectName("");
                }
              }}
              placeholder="Nombre de la materia"
            />
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <ThemeToggle />
        <Tooltip label="Configuración">
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Configuración">
            <GearIcon />
          </button>
        </Tooltip>
      </div>

      {contextMenu && (
        <ContextMenu
          position={contextMenu.position}
          items={
            contextMenu.target.kind === "note"
              ? noteMenuItems(contextMenu.target.note)
              : subjectMenuItems(contextMenu.target.id, contextMenu.target.name)
          }
          onClose={() => setContextMenu(null)}
        />
      )}

      {confirmTarget && (
        <ConfirmDialog
          title={confirmTarget.kind === "note" ? "¿Eliminar la nota?" : "¿Eliminar la materia?"}
          message={
            confirmTarget.kind === "note"
              ? `"${confirmTarget.note.title || "Sin título"}" se eliminará permanentemente.`
              : `"${confirmTarget.name}" y todas sus notas se eliminarán permanentemente.`
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  );
}

function InlineRenameInput({
  initialValue,
  className,
  onSubmit,
  onCancel,
}: {
  initialValue: string;
  className: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLInputElement>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <input
      ref={ref}
      className={className}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={() => {
        // Enter/Escape already resolve this input below; losing focus as a
        // side effect of that (e.g. the input unmounting) shouldn't submit
        // a second time with the same value.
        if (settledRef.current) return;
        settledRef.current = true;
        onSubmit(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          settledRef.current = true;
          onSubmit(value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          settledRef.current = true;
          onCancel();
        }
      }}
    />
  );
}

function NoteRow({
  note,
  active,
  sub,
  renaming,
  onSelect,
  onDeleteRequest,
  onContextMenu,
  onStartRename,
  onSubmitRename,
  onCancelRename,
}: {
  note: NoteSummary;
  active: boolean;
  sub?: boolean;
  renaming: boolean;
  onSelect: () => void;
  onDeleteRequest: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onStartRename: () => void;
  onSubmitRename: (title: string) => void;
  onCancelRename: () => void;
}) {
  return (
    <div
      className={"sidebar-row note-row" + (sub ? " sub" : "") + (active ? " active" : "")}
      onContextMenu={onContextMenu}
    >
      {renaming ? (
        <InlineRenameInput
          initialValue={note.title}
          className="row-main row-rename-input"
          onSubmit={onSubmitRename}
          onCancel={onCancelRename}
        />
      ) : (
        <button
          className="row-main"
          onClick={onSelect}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onStartRename();
          }}
        >
          <span className="note-row-title">{note.title || "Sin título"}</span>
          <span className="note-row-time">{timeAgo(note.updated_at)}</span>
        </button>
      )}
      <Tooltip label="Eliminar nota">
        <button className="row-delete" aria-label={`Eliminar ${note.title || "Sin título"}`} onClick={onDeleteRequest}>
          <TrashIcon />
        </button>
      </Tooltip>
    </div>
  );
}
