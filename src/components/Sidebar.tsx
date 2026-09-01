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
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
    { id: "open", label: "Open", onSelect: () => handleSelectNote(note.id) },
    { id: "rename", label: "Rename", onSelect: () => setRenamingId(note.id) },
    { id: "duplicate", label: "Duplicate", onSelect: () => handleDuplicateNote(note) },
    {
      id: "delete",
      label: "Delete",
      destructive: true,
      separatorBefore: true,
      onSelect: () => setConfirmTarget({ kind: "note", note }),
    },
  ];
  const subjectMenuItems = (id: string, name: string): ContextMenuItem[] => [
    { id: "rename", label: "Rename", onSelect: () => setRenamingId(id) },
    {
      id: "delete",
      label: "Delete",
      destructive: true,
      separatorBefore: true,
      onSelect: () => setConfirmTarget({ kind: "subject", id, name }),
    },
  ];

  if (collapsed) {
    return (
      <div className="sidebar collapsed">
        <Tooltip label="Expand sidebar">
          <button className="icon-btn" onClick={toggleSidebar} aria-label="Expand sidebar">
            <ChevronIcon dir="right" />
          </button>
        </Tooltip>
        <Tooltip label="New note (Ctrl N)">
          <button className="icon-btn" onClick={handleNewNote} aria-label="New note">
            <PlusIcon />
          </button>
        </Tooltip>
        <Tooltip label="Search (Ctrl K)">
          <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search">
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
        <Tooltip label="Collapse sidebar">
          <button className="icon-btn" onClick={toggleSidebar} aria-label="Collapse sidebar">
            <ChevronIcon dir="left" />
          </button>
        </Tooltip>
      </div>

      <div className="sidebar-actions">
        <button className="text-btn sidebar-action" onClick={handleNewNote}>
          <PlusIcon /> New note
        </button>
        <button className="text-btn sidebar-action" onClick={() => setSearchOpen(true)}>
          <SearchIcon /> Search
          <kbd className="sidebar-kbd">Ctrl K</kbd>
        </button>
      </div>

      <div className="sidebar-scroll">
        {recentNotes.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Recent</div>
            <button
              className={"sidebar-row" + (view.kind === "recent" ? " active" : "")}
              onClick={() => setView({ kind: "recent" })}
            >
              All recent notes
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
                  if (title.trim() && title !== n.title) renameNote(n.id, title.trim(), n.subject_id);
                }}
                onCancelRename={() => setRenamingId(null)}
              />
            ))}
          </div>
        )}

        <div className="sidebar-section">
          <div className="sidebar-section-title">
            Subjects
            <Tooltip label="New subject (Ctrl Shift N)">
              <button className="icon-btn tiny" onClick={() => setAddingSubject(true)} aria-label="New subject">
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
                <Tooltip label="Delete subject">
                  <button
                    className="row-delete"
                    aria-label={`Delete ${s.name}`}
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
                        if (title.trim() && title !== n.title) renameNote(n.id, title.trim(), n.subject_id);
                      }}
                      onCancelRename={() => setRenamingId(null)}
                    />
                  ))}
                  {activeSubjectNotes.length === 0 && <div className="sidebar-empty-hint">No notes yet</div>}
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
              placeholder="Subject name"
            />
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <ThemeToggle />
        <Tooltip label="Settings">
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings">
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
          title={confirmTarget.kind === "note" ? "Delete note?" : "Delete subject?"}
          message={
            confirmTarget.kind === "note"
              ? `"${confirmTarget.note.title || "Untitled"}" will be permanently deleted.`
              : `"${confirmTarget.name}" and all its notes will be permanently deleted.`
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

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      className={className}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => onSubmit(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSubmit(value);
        } else if (e.key === "Escape") {
          e.preventDefault();
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
        <button className="row-main" onClick={onSelect} onDoubleClick={onStartRename}>
          <span className="note-row-title">{note.title || "Untitled"}</span>
          <span className="note-row-time">{timeAgo(note.updated_at)}</span>
        </button>
      )}
      <Tooltip label="Delete note">
        <button className="row-delete" aria-label={`Delete ${note.title || "Untitled"}`} onClick={onDeleteRequest}>
          <TrashIcon />
        </button>
      </Tooltip>
    </div>
  );
}
