import type { ReactNode } from "react";

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="tooltip-wrap" data-tooltip={label}>
      {children}
    </span>
  );
}
