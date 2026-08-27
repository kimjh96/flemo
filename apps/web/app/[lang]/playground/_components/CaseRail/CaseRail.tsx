"use client";

export interface CaseOption {
  id: string;
  label: string;
  /** Set when choosing this case leaves the page instead of swapping the stage. */
  href?: string;
}

export interface CaseRailProps {
  options: CaseOption[];
  value: string;
  onChange: (id: string) => void;
}

// The three cases, on one rail.
//
// One page, one stage, one question at a time. The old playground stacked two
// full-viewport hero sections and hid a third case at an unlinked URL, which
// meant the second case was reachable only by scrolling past a phone that
// swallowed the wheel, and the third was reachable only by knowing it existed.
//
// A case is not a variable. Two of the three cases carry several controls,
// because the arrangement worth judging needs them — what makes it one case is
// that everything on screen exists to set up a single question.
function CaseRail({ options, value, onChange }: CaseRailProps) {
  return (
    <div
      role="tablist"
      aria-label="cases"
      className="flex w-fit gap-1 rounded-2xl bg-[var(--color-layer)] p-1"
    >
      {options.map((option) => {
        const selected = option.id === value;

        return option.href ? (
          // The layering case opens its own full-viewport route. It has to: a
          // `position: fixed` overlay means the viewport, and a stage frame
          // inside a scrolling page only means the frame if the frame is
          // transformed — at which point the case is measuring a transform it
          // invented, in exactly the class of bug it exists to judge.
          <a
            key={option.id}
            href={option.href}
            role="tab"
            aria-selected="false"
            className="flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]"
          >
            {option.label}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M7 17L17 7M17 7H9M17 7v8"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        ) : (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.id)}
            className={`cursor-pointer rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors ${
              selected
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default CaseRail;
