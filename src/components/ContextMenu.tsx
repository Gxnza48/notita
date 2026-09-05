import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CheckIcon } from "./icons";

export interface ContextMenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  separatorBefore?: boolean;
  /** Shows a checkmark next to the label — for a toggle whose current state (e.g. "bold is on") is worth surfacing. */
  checked?: boolean;
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export function ContextMenu({
  position,
  items,
  onClose,
}: {
  position: ContextMenuPosition;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [style, setStyle] = useState<{ left: number; top: number }>({ left: position.x, top: position.y });

  // clamp to viewport so the menu never renders partially off-screen
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(position.x, window.innerWidth - rect.width - margin);
    const top = Math.min(position.y, window.innerHeight - rect.height - margin);
    setStyle({ left: Math.max(margin, left), top: Math.max(margin, top) });
  }, [position]);

  // roving focus: real DOM focus follows the active item, matching what
  // role="menu"/"menuitem" promises assistive tech
  useEffect(() => {
    itemRefs.current[activeIndex]?.focus();
  }, [activeIndex]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        items[activeIndex]?.onSelect();
        onClose();
      }
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [items, activeIndex, onClose]);

  return (
    <div ref={menuRef} className="context-menu" style={{ left: style.left, top: style.top }} role="menu">
      {items.map((item, i) => (
        <div key={item.id}>
          {item.separatorBefore && <div className="context-menu-separator" role="separator" />}
          <button
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            role="menuitem"
            tabIndex={i === activeIndex ? 0 : -1}
            className={"context-menu-item" + (item.destructive ? " destructive" : "") + (i === activeIndex ? " active" : "")}
            onMouseEnter={() => setActiveIndex(i)}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              item.onSelect();
              onClose();
            }}
          >
            <span className="context-menu-item-label">{item.label}</span>
            {item.checked && <CheckIcon size={11} />}
          </button>
        </div>
      ))}
    </div>
  );
}
