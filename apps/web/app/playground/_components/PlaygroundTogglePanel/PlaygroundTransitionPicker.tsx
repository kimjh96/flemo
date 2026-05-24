import type { PushTransition } from "@/app/playground/_stores/usePlaygroundSettingsStore";

import type { TransitionOption } from "./PlaygroundTogglePanel.types";

export interface PlaygroundTransitionPickerProps {
  options: ReadonlyArray<TransitionOption>;
  value: PushTransition;
  onChange: (next: PushTransition) => void;
}

function PlaygroundTransitionPicker({ options, value, onChange }: PlaygroundTransitionPickerProps) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Push transition">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className="flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-all"
            style={{
              borderColor: active ? "var(--color-primary)" : "var(--color-border)",
              backgroundColor: active ? "var(--color-primary)" : "var(--color-card)",
              color: active ? "white" : "var(--color-text-primary)",
              boxShadow: active ? "0 1px 6px -2px rgba(15,19,27,0.2)" : "none"
            }}
          >
            <span>{option.label}</span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
              style={{
                backgroundColor: active
                  ? "rgba(255,255,255,0.18)"
                  : option.source === "Custom"
                    ? "var(--color-primary)"
                    : "var(--color-neutral-200)",
                color: active
                  ? "white"
                  : option.source === "Custom"
                    ? "white"
                    : "var(--color-text-secondary)"
              }}
            >
              {option.source}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default PlaygroundTransitionPicker;
