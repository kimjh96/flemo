import { segments } from "./LibraryScreen.constants";

import type { Segment } from "./LibraryScreen.types";

export interface LibrarySegmentBarProps {
  value: Segment;
  onChange: (next: Segment) => void;
}

function LibrarySegmentBar({ value, onChange }: LibrarySegmentBarProps) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-layer)] p-1">
      {segments.map((segment) => {
        const active = value === segment.key;
        return (
          <button
            key={segment.key}
            type="button"
            onClick={() => onChange(segment.key)}
            className="flex-1 rounded-full py-1.5 text-[12px] font-semibold transition-colors"
            style={{
              backgroundColor: active ? "var(--color-surface)" : "transparent",
              color: active ? "var(--color-text-primary)" : "var(--color-ink-mute)",
              boxShadow: active ? "0 1px 0 var(--color-line)" : "none"
            }}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}

export default LibrarySegmentBar;
