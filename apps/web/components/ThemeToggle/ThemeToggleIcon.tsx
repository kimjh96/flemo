import type { ThemeKind } from "./ThemeToggle.constants";

const STROKE_PROPS = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round"
} as const;

export interface ThemeToggleIconProps {
  kind: ThemeKind;
}

function ThemeToggleIcon({ kind }: ThemeToggleIconProps) {
  if (kind === "light") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" {...STROKE_PROPS}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v1.5" />
        <path d="M12 19.5V21" />
        <path d="M3 12h1.5" />
        <path d="M19.5 12H21" />
        <path d="M5.4 5.4l1.06 1.06" />
        <path d="M17.54 17.54l1.06 1.06" />
        <path d="M5.4 18.6l1.06-1.06" />
        <path d="M17.54 6.46l1.06-1.06" />
      </svg>
    );
  }
  if (kind === "dark") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" {...STROKE_PROPS}>
        <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...STROKE_PROPS}>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

export default ThemeToggleIcon;
