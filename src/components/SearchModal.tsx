import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { SearchIcon } from "./icons";
import { api } from "../lib/tauri";
import type { SearchHit } from "../lib/types";
import { useUiStore } from "../lib/uiStore";
import { useDataStore } from "../lib/dataStore";

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function SearchModal() {
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const setActiveNoteId = useUiStore((s) => s.setActiveNoteId);
  const setView = useUiStore((s) => s.setView);
  const openNote = useDataStore((s) => s.openNote);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      const hits = await api.searchNotes(trimmed);
      setResults(hits);
      setActiveIndex(0);
    }, 80);
    return () => window.clearTimeout(handle);
  }, [query]);

  const select = async (hit: SearchHit) => {
    setView({ kind: "subject", subjectId: hit.subject_id });
    setActiveNoteId(hit.note_id);
    await openNote(hit.note_id);
    setSearchOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      select(results[activeIndex]);
    }
  };

  return (
    <Modal onClose={() => setSearchOpen(false)}>
      <div className="palette-input-row">
        <SearchIcon size={16} />
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Buscar títulos, contenido, materias…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="palette-list">
        {query.trim() && results.length === 0 && <div className="palette-empty">Sin resultados</div>}
        {results.map((hit, i) => (
          <button
            key={hit.note_id}
            className={"palette-item" + (i === activeIndex ? " active" : "")}
            onMouseEnter={() => setActiveIndex(i)}
            onClick={() => select(hit)}
          >
            <div className="palette-item-top">
              <span className="palette-item-title">{highlight(hit.title || "Sin título", query)}</span>
              <span className="palette-item-subject">{hit.subject_name}</span>
            </div>
            <div className="palette-item-snippet">{highlight(hit.snippet, query)}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
