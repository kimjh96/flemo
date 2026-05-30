"use client";

// A token-constrained color picker. Options are design-system tokens (or an
// "inherit" option mapping to `""`), so the playground can't introduce a raw
// hex outside the shiflo set.
export interface ColorSwatchOption {
  label: string;
  value: string;
}

export interface PlaygroundColorSwatchProps {
  label: string;
  value: string;
  options: ReadonlyArray<ColorSwatchOption>;
  onChange: (next: string) => void;
}

function PlaygroundColorSwatch({ label, value, options, onChange }: PlaygroundColorSwatchProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-[var(--color-text-primary)]">{label}</span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] font-medium transition-colors"
              style={{
                borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                backgroundColor: active ? "var(--color-layer)" : "var(--color-card)",
                color: "var(--color-text-primary)"
              }}
            >
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 rounded-full border border-[var(--color-border)]"
                style={{
                  backgroundColor: option.value || "transparent",
                  backgroundImage: option.value
                    ? undefined
                    : "linear-gradient(45deg, var(--color-neutral-300) 25%, transparent 25%, transparent 75%, var(--color-neutral-300) 75%)"
                }}
              />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PlaygroundColorSwatch;
