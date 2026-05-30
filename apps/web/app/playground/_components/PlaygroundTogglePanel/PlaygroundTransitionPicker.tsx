"use client";

import type { PushTransitionOverride } from "@/app/playground/_stores/usePlaygroundSettingsStore";

import type { TransitionGroup, TransitionOption } from "./PlaygroundTogglePanel.types";

export interface PlaygroundTransitionPickerProps {
  groups: ReadonlyArray<TransitionGroup>;
  value: PushTransitionOverride | null;
  onChange: (next: PushTransitionOverride | null) => void;
}

function PlaygroundTransitionPicker({ groups, value, onChange }: PlaygroundTransitionPickerProps) {
  return (
    <div className="flex flex-col gap-4" role="radiogroup" aria-label="Push transition override">
      {groups.map((group) => (
        <div key={group.kind} className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
              {group.kind}
            </span>
            <span className="text-[11px] leading-snug text-[var(--color-ink-mute)]">
              {group.caption}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => (
              <Chip
                key={option.value}
                option={option}
                active={option.value === value}
                onSelect={onChange}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface ChipProps {
  option: TransitionOption;
  active: boolean;
  onSelect: (next: PushTransitionOverride | null) => void;
}

function Chip({ option, active, onSelect }: ChipProps) {
  const handleClick = () => onSelect(active ? null : option.value);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={handleClick}
      className="rounded-full border px-4 py-2 text-[13px] font-semibold transition-all"
      style={{
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
        backgroundColor: active ? "var(--color-primary)" : "var(--color-card)",
        color: active ? "white" : "var(--color-text-primary)"
      }}
    >
      {option.label}
    </button>
  );
}

export default PlaygroundTransitionPicker;
