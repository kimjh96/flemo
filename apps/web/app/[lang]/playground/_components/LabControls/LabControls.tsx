"use client";

import { useRef } from "react";

import { useNavigate, usePathname } from "@flemo/react";

import { TRANSITION_GROUPS } from "../../_data/transitions";
import useHeightToCssVariable from "../../_hooks/useHeightToCssVariable";
import { useLabSettings, type LabTransition } from "../../_providers/LabSettingsProvider";

// Published on the lab stage so the source panel can reserve exactly the dock's
// height and never let code scroll behind it (see LabCodePanel).
const DOCK_HEIGHT_VARIABLE = "--lab-dock-height";

// The floating control bar over the full-page stage. Pick a transition, then
// Next pushes the following panel using it (experienced full-screen); Back pops.
// Chips are grouped into "Built-in" (ship with flemo) and "Custom" (authored in
// this app); the two combos that also run a decorator carry a "+decorator" tag.
// A slim entry row links to the stress lab. The dock is the panel-browser chrome,
// so it hides itself on the stress lab and heavy fixture (those screens own their
// own affordances and want a clean full-bleed stage).
function LabControls() {
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
    navigate.push("/playground/stress", {}, { transitionName: "cupertino" });
  };

  // Not a panel-browser context: on the stress lab / heavy fixture the dock's
  // controls (panel picker, Next/Back) don't apply. The dock lives OUTSIDE the
  // transitioning <Slot>, so it can't ride the screen transition — an unmount
  // would vanish it in one frame while the screens glide, which reads broken in
  // a transition showcase. Instead it stays mounted and animates itself out
  // (slide down + fade on its own clock), mirroring the screens' motion.
  const dockHidden = segment === "stress" || segment === "heavy";

  return (
    <div
      ref={dockRef}
      aria-hidden={dockHidden || undefined}
      // `inert` blocks focus/AT while hidden; the inner container drops its
      // pointer-events-auto so the invisible dock can never intercept taps.
      inert={dockHidden || undefined}
      className={`pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-4 transition-[opacity,transform] duration-300 ease-out ${
        dockHidden ? "translate-y-6 opacity-0" : ""
      }`}
    >
      <div
        className={`${dockHidden ? "" : "pointer-events-auto"} flex w-full max-w-md flex-col gap-2.5 rounded-3xl border border-white/15 bg-[var(--color-bg)]/70 p-3 shadow-[0_20px_50px_-18px_rgba(0,0,0,0.6)] backdrop-blur-2xl`}
      >
        <button
          type="button"
          onClick={handleOpenStressLab}
          data-testid="lab-stress-entry"
          className="flex cursor-pointer items-center gap-2 rounded-2xl bg-[var(--color-layer)] px-3 py-2 text-left transition-colors hover:bg-[var(--color-border-light)]"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-primary)]/12 text-[var(--color-primary)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-[var(--color-text-primary)]">
              Stress lab
            </span>
            <span className="block truncate text-[11px] font-medium text-[var(--color-text-secondary)]">
              Can heavy content freeze a transition?
            </span>
          </span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0 text-[var(--color-text-disabled)]"
          >
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

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
          <button
            type="button"
            onClick={handleNext}
            className="ml-auto flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--color-primary)] pr-4 pl-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
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
