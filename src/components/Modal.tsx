import { useEffect, type ReactNode } from "react";

export function Modal({
  onClose,
  children,
  panelClassName,
  centered,
}: {
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
  /** Center vertically (used for small alert-style dialogs) instead of anchoring near the top like the command palette. */
  centered?: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className={"modal-overlay" + (centered ? " centered" : "")}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={"modal-panel" + (panelClassName ? ` ${panelClassName}` : "")}>{children}</div>
    </div>
  );
}
