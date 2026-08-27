"use client";

import { useHistoryStore } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import { useFlightBeat } from "../../_hooks/useFlightParts";

import { BOOKING } from "../../_data/booking";

// The checkout progress rail: chrome of the Router, drawn beside the stack
// rather than inside it.
//
// This is the same structural move a shared bar makes, one level up. A rail
// rendered inside each screen would travel with the screens and re-enter on
// every push, which is exactly what a progress indicator must not do — the
// thing that tells you where you are cannot itself be sliding away. Rendering
// it OUTSIDE the <Slot> takes it out of every flight without any screen having
// to declare it.
//
// It reads `useHistoryStore` rather than being told where it is. The stack is
// the source, so the rail cannot drift out of step with what the pops actually
// did — press back four times quickly and it unwinds exactly four, because it
// is not counting presses.
//
// WHY THIS IS NOT A <Part>, which was tried first and measured wrong.
//
// A Part is the obvious tool for chrome that must move with a navigation, and
// it is the wrong one HERE. `Part` resolves its status from the enclosing
// SCREEN's owner, deliberately: "a part in a nested Router's chrome belongs to
// the outer flight". The whole playground is one screen of the site's own
// Router, so a Part in this position reported `status="IDLE" active="true"` —
// the shell's state — and sat perfectly still through every booking flight.
// Measured, not assumed: it read 0s while its screens ran 0.7s.
//
// So the rail animates itself, on the flight's own clock read from the same
// table every part transition is generated from. It is not pretending to be a
// Part; it is chrome that shares the navigation's timing. What it must never
// do is invent a third clock — the version before this used a hardcoded CSS
// `duration-300` next to screens running anywhere from 0s to 0.7s.
function StepRail() {
  const index = useHistoryStore((state) => state.index);
  const beat = useFlightBeat();
  const t = getDict(useShellLang()).playground.booking;

  // A cut gets no transition at all: everything riding an instant screen change
  // has to cut with it.
  const timing = {
    transitionDuration: `${beat.duration}s`,
    transitionTimingFunction: `cubic-bezier(${beat.ease.join(",")})`
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--color-border-light)] bg-[var(--color-bg)] px-4 py-2.5">
      {BOOKING.map((step, position) => {
        const reached = position <= index;

        return (
          <span key={step.id} className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              style={timing}
              className={`h-[3px] min-w-0 flex-1 rounded-full transition-colors ${
                reached ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
              }`}
            />
            {position === index ? (
              // Marked so the flight audit can compare WHEN this label changes,
              // and on what clock, against the screens it is describing.
              <span
                data-step-rail-current=""
                style={timing}
                className="shrink-0 text-[10px] font-bold tracking-[0.06em] text-[var(--color-primary)] uppercase transition-opacity"
              >
                {t.steps[step.id as keyof typeof t.steps]}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

export default StepRail;
