/**
 * Single source of truth for every icon in the app: consistent 14x14 base
 * viewBox, consistent 1.4 stroke weight, no fills — keeps every icon
 * visually related regardless of where it's used.
 */
interface IconProps {
  size?: number;
}

const STROKE = 1.4;

export function PlusIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth={STROKE} />
      <path d="M13 13L9.5 9.5" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
    </svg>
  );
}

export function ChevronIcon({ dir, size = 14 }: { dir: "left" | "right" } & IconProps) {
  const d = dir === "left" ? "M9 2L4 7L9 12" : "M5 2L10 7L5 12";
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d={d} stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GearIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="2.1" stroke="currentColor" strokeWidth={STROKE} />
      <path
        d="M7 1.3v1.3M7 11.4v1.3M12.7 7h-1.3M2.6 7H1.3M11 3l-.9.9M3.9 10.1l-.9.9M11 11l-.9-.9M3.9 3.9L3 3"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CloseIcon({ size = 11 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 11 11" fill="none">
      <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
    </svg>
  );
}

export function TrashIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path
        d="M2.3 3.6H11.7M5.4 3.6V2.3C5.4 1.9 5.7 1.6 6.1 1.6H7.9C8.3 1.6 8.6 1.9 8.6 2.3V3.6M6.1 6.2V10.2M7.9 6.2V10.2M3.3 3.6L3.8 11.3C3.85 11.85 4.3 12.3 4.85 12.3H9.15C9.7 12.3 10.15 11.85 10.2 11.3L10.7 3.6"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EditIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path
        d="M9.4 1.9L12.1 4.6L4.6 12.1L1.5 12.5L1.9 9.4L9.4 1.9Z"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CopyIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <rect x="4.6" y="4.6" width="7.8" height="7.8" rx="1.3" stroke="currentColor" strokeWidth={STROKE} />
      <path d="M2.4 9.4V2.9C2.4 2.24 2.94 1.7 3.6 1.7H9.4" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
    </svg>
  );
}

export function SunIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className="theme-icon sun">
      <circle cx="6" cy="6" r="2.6" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M6 0.8V2M6 10V11.2M11.2 6H10M2 6H0.8M9.5 2.5L8.6 3.4M3.4 8.6L2.5 9.5M9.5 9.5L8.6 8.6M3.4 3.4L2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoonIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className="theme-icon moon">
      <path
        d="M10.5 7.4A4.6 4.6 0 1 1 4.6 1.5a3.7 3.7 0 0 0 5.9 5.9Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
