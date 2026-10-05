"use client";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  mono?: boolean;
  className?: string;
}

// Radio semantics, segmented look. Used for every "pick one" on the site:
// package manager, transition, code tab.
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  mono,
  className
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex flex-wrap gap-0.5 rounded-md border border-line bg-bg-subtle p-0.5 ${className ?? ""}`}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={`rounded-sm px-2.5 whitespace-nowrap transition-colors ${size === "sm" ? "h-7 text-xs" : "h-8 text-sm"} ${
              mono ? "font-mono" : "font-medium"
            } ${on ? "bg-surface text-fg shadow-raised ring-1 ring-line" : "text-fg-subtle hover:text-fg"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
