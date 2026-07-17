"use client";

import { useRef } from "react";

import { Part, useNavigate, usePathname } from "@flemo/react";

import { TRANSITION_GROUPS } from "../../_data/transitions";
import useHeightToCssVariable from "../../_hooks/useHeightToCssVariable";
import { useLabSettings, type LabTransition } from "../../_providers/LabSettingsProvider";

// Published on the lab stage so the source panel can reserve exactly the dock's
// height and never let code scroll behind it (see LabCodePanel).
const DOCK_HEIGHT_VARIABLE = "--lab-dock-height";

export interface LabControlsProps {
  // Pushes the stress lab on the OUTER lab Router. The stress route lives one
  // level above the panels sub-app this dock belongs to, so the handler is
  // wired by LabPanelsScreen (which holds the outer navigate).
  onOpenStressLab: () => void;
}

// The floating control dock over the panel stage. Pick a transition, then Next
// pushes the following panel using it (experienced full-screen); Back pops.
// Chips are grouped into "Built-in" (ship with flemo) and "Custom" (authored in
// this app); the two combos that also run a decorator carry a "+decorator" tag.
// A compact bolt button on the action row opens the stress lab (kept small so
// the dock covers as little of the stage as possible); it wears
// <Part name="stress-entry"> so the registered part transition choreographs it
// with the panels screen's lifecycle and the swipe drag. The dock is the panels
// Router's persistent chrome (outside its Slot): it holds still across panel
// moves, and because the panels Router nests inside the outer LabRouter's
// panels screen, a push to the stress lab carries the whole screen — dock
// included — out of the stage. No per-route hiding of its own.
function LabControls({ onOpenStressLab }: LabControlsProps) {
  const navigate = useNavigate();
  // The current panel comes from the route, not a separate counter, so it can't
  // drift from the panel screen (e.g. after a useStep source step pops).
  const pathname = usePathname();
  const segment = pathname.split("/")[2]?.split("?")[0];
  const step = Number(segment ?? "1") || 1;
  const { transition, setTransition } = useLabSettings();
  const dockRef = useRef<HTMLDivElement>(null);
  useHeightToCssVariable(dockRef, DOCK_HEIGHT_VARIABLE);

  const handleSelectTransition = (next: LabTransition) => {
    setTransition(next);
  };

  const handleNext = () => {
    navigate.push("/playground/:n", { n: String(step + 1) }, { transitionName: transition });
  };

  const handleBack = () => {
    if (step <= 1) return;
    navigate.pop();
  };

  const handleOpenStressLab = () => {
    onOpenStressLab();
  };

  return (
    <div
      ref={dockRef}
      className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2.5 rounded-3xl border border-white/15 bg-[var(--color-bg)]/70 p-3 shadow-[0_20px_50px_-18px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        {TRANSITION_GROUPS.map((group) => (
          <div key={group.kind} className="flex flex-col gap-1.5">
            <span className="px-1 text-[10px] font-bold tracking-[0.12em] text-[var(--color-text-disabled)] uppercase">
              {group.label}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((option) => {
                const active = transition === option.slug;
                return (
                  <button
                    key={option.slug}
                    type="button"
                    onClick={() => handleSelectTransition(option.slug)}
                    aria-pressed={active}
                    className={`flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                      active
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--color-layer)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    {option.label}
                    {option.decorator ? (
                      <span
                        aria-hidden="true"
                        className={`rounded-full px-1.5 py-px text-[9px] font-bold ${
                          active
                            ? "bg-white/25 text-white"
                            : "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                        }`}
                      >
                        +{option.decorator}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mt-0.5 flex items-center gap-2 border-t border-white/10 pt-2.5">
          <button
            type="button"
            onClick={handleBack}
            disabled={step <= 1}
            aria-label="Back"
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-[var(--color-layer)] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-border)] disabled:cursor-default disabled:opacity-30"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span className="text-[13px] font-semibold text-[var(--color-text-secondary)]">
            Screen {step}
          </span>
          <Part name="stress-entry" className="ml-auto shrink-0">
            <button
              type="button"
              onClick={handleOpenStressLab}
              data-testid="lab-stress-entry"
              aria-label="Stress lab"
              title="Stress lab — can heavy content freeze a transition?"
              className="grid size-10 cursor-pointer place-items-center rounded-full bg-[var(--color-primary)]/12 text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/22"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </Part>
          <button
            type="button"
            onClick={handleNext}
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--color-primary)] pr-4 pl-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            Next
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
  );
}

export default LabControls;
