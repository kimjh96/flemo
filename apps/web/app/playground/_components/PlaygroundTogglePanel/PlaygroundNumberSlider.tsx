"use client";

import type { ChangeEvent } from "react";

// A labeled length knob: preset chips for the common values plus a range
// slider for fine control. Value is a CSS length string ("0px", "24px", …)
// so it threads straight into ScreenProps.
export interface PlaygroundNumberSliderProps {
  label: string;
  value: string;
  presets: ReadonlyArray<string>;
  min?: number;
  max?: number;
  step?: number;
  onChange: (next: string) => void;
}

const toPx = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

function PlaygroundNumberSlider({
  label,
  value,
  presets,
  min = 0,
  max = 64,
  step = 4,
  onChange
}: PlaygroundNumberSliderProps) {
  const current = toPx(value);

  const handleSlide = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(`${event.target.value}px`);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-[var(--color-text-primary)]">{label}</span>
        <span className="text-[12px] tabular-nums text-[var(--color-ink-mute)]">{value}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const active = preset === value;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className="rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors"
              style={{
                borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                backgroundColor: active ? "var(--color-primary)" : "var(--color-card)",
                color: active ? "white" : "var(--color-text-primary)"
              }}
            >
              {preset}
            </button>
          );
        })}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={handleSlide}
        aria-label={label}
        className="h-1 w-full cursor-pointer accent-[var(--color-primary)]"
      />
    </div>
  );
}

export default PlaygroundNumberSlider;
