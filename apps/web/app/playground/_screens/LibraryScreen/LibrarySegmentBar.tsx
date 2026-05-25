import { segments } from "./LibraryScreen.constants";

import type { Segment, SegmentDef } from "./LibraryScreen.types";

export interface LibrarySegmentBarProps {
  value: Segment;
  onChange: (next: Segment) => void;
}

function LibrarySegmentBar({ value, onChange }: LibrarySegmentBarProps) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-layer)] p-1">
      {segments.map((segment) => (
        <LibrarySegmentButton
          key={segment.key}
          segment={segment}
          active={value === segment.key}
          onSelect={onChange}
        />
      ))}
    </div>
  );
}

interface LibrarySegmentButtonProps {
  segment: SegmentDef;
  active: boolean;
  onSelect: (next: Segment) => void;
}

function LibrarySegmentButton({ segment, active, onSelect }: LibrarySegmentButtonProps) {
  const handleClick = () => onSelect(segment.key);

  return (
    <button
      type="button"
      onClick={handleClick}
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
}

export default LibrarySegmentBar;
