"use client";

import { useState } from "react";

import { Screen, useNavigate } from "@flemo/react";

import { flashTapMarker } from "../../_components/LabTapMarker";

// The stress lab: the playground's demonstration of flemo's core guarantee —
// heavy destination content can't break a transition. You choose how expensive
// the next screen is to render, then run it; the screen enters with its real
// content in the first frame, and a heavy render delays the start by that work
// while the motion still plays in full (never cut short or skipped). It reaches
// the HeavyScreen fixture (a deterministic busy-render) with the chosen
// combination, so what visitors watch is exactly what the perception harness
// measures.
//
// A first-class, self-explanatory screen that reads as a sibling of the
// transition panels. The measurement script drives these same controls.

type StressTransition = "cupertino" | "fade";
type StressShape = "atomic" | "sliced";

interface Option<T extends string> {
  value: T;
  label: string;
  // A one-line plain-words explanation shown under the group when selected.
  hint?: string;
}

const TRANSITIONS: Option<StressTransition>[] = [
  { value: "cupertino", label: "Cupertino" },
  { value: "fade", label: "Fade" }
];

const SHAPES: Option<StressShape>[] = [
  {
    value: "atomic",
    label: "Atomic",
    hint: "One component. Worst case: React can't yield mid-render."
  },
  {
    value: "sliced",
    label: "Sliced",
    hint: "Many small rows, the shape of a real list. React can yield between them."
  }
];

const COSTS = [0, 200, 400, 800] as const;

// A labelled segmented control, the same active/idle pill language as the
// transition picker dock, kept in-file as a tightly-coupled render helper (the
// HeavyScreen fixture next door colocates its render helpers the same way).
interface StressFieldProps<T extends string> {
  label: string;
  options: Option<T>[];
  value: T;
  onSelect: (value: T) => void;
  testIdPrefix: string;
}

function StressField<T extends string>({
  label,
  options,
  value,
  onSelect,
  testIdPrefix
}: StressFieldProps<T>) {
  const activeHint = options.find((option) => option.value === value)?.hint;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold tracking-[0.08em] text-[var(--color-text-secondary)] uppercase">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              data-testid={`${testIdPrefix}-${option.value}`}
              onClick={() => onSelect(option.value)}
              aria-pressed={active}
              className={`flex-1 cursor-pointer rounded-full px-3 py-2 text-[13px] font-semibold transition-colors ${
                active
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-layer)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {activeHint ? (
        <span className="text-[13px] leading-snug text-[var(--color-text-secondary)]">
          {activeHint}
        </span>
      ) : null}
    </div>
  );
}

function StressLabScreen() {
  const navigate = useNavigate();
  const [transition, setTransition] = useState<StressTransition>("cupertino");
  const [shape, setShape] = useState<StressShape>("atomic");
  const [cost, setCost] = useState<(typeof COSTS)[number]>(400);

  const handleSelectTransition = (next: StressTransition) => {
    setTransition(next);
  };

  const handleSelectShape = (next: StressShape) => {
    setShape(next);
  };

  const handleSelectCost = (next: (typeof COSTS)[number]) => {
    setCost(next);
  };

  const handleRun = () => {
    // Flash the measurement anchor in the SAME synchronous tick as the push, so
    // the analyzer's tap marker and the transition's start share one clock.
    flashTapMarker();
    navigate.push(
      "/playground/heavy",
      shape === "sliced" ? { block: String(cost), sliced: "1" } : { block: String(cost) },
      { transitionName: transition }
    );
  };

  const handleBack = () => {
    navigate.pop();
  };

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--color-layer)">
      <div className="h-full w-full overflow-y-auto bg-[var(--color-layer)]">
        <div className="flex min-h-full items-center justify-center px-5 py-24">
          <div className="w-full max-w-md">
            <button
              type="button"
              onClick={handleBack}
              data-testid="stress-back"
              className="mb-5 inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M15 18l-6-6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Panels
            </button>

            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
              <span className="text-[13px] font-semibold tracking-[0.04em] text-[var(--color-primary)] uppercase">
                Stress lab
              </span>
              <h1 className="mt-2 text-2xl leading-tight font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
                Heavy content can&rsquo;t break a transition
              </h1>
              <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                Pick how expensive the next screen is to render, then run it. The screen enters with
                its real content in the first frame; a heavy render delays the start by that work,
                but the motion always plays in full. It is never cut short or skipped.
              </p>

              <div className="mt-6 flex flex-col gap-5">
                <StressField
                  label="Transition"
                  options={TRANSITIONS}
                  value={transition}
                  onSelect={handleSelectTransition}
                  testIdPrefix="stress-transition"
                />
                <StressField
                  label="Content shape"
                  options={SHAPES}
                  value={shape}
                  onSelect={handleSelectShape}
                  testIdPrefix="stress-shape"
                />
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold tracking-[0.08em] text-[var(--color-text-secondary)] uppercase">
                    Render cost
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {COSTS.map((option) => {
                      const active = option === cost;
                      return (
                        <button
                          key={option}
                          type="button"
                          data-testid={`stress-cost-${option}`}
                          onClick={() => handleSelectCost(option)}
                          aria-pressed={active}
                          className={`flex-1 cursor-pointer rounded-full px-3 py-2 text-[13px] font-semibold transition-colors ${
                            active
                              ? "bg-[var(--color-primary)] text-white"
                              : "bg-[var(--color-layer)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                          }`}
                        >
                          {option}ms
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[13px] leading-snug text-[var(--color-text-secondary)]">
                    How long the next screen busy-renders on mount before it can paint.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRun}
                data-testid="stress-run"
                className="cta-pill mt-7 w-full justify-center"
              >
                Run transition
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M9 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

export default StressLabScreen;
