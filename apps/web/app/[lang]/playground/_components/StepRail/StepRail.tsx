"use client";

import { useHistoryStore } from "@flemo/react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import { BOOKING } from "../../_data/booking";

// The checkout progress rail: chrome of the Router, drawn beside the stack
// rather than inside it.
//
// This is the same structural move a shared bar makes, one level up. A rail
// rendered inside each screen would travel with the screens and re-enter on
// every push, which is exactly what a progress indicator must not do — the
// thing that tells you where you are cannot itself be moving. Rendering it
// OUTSIDE the <Slot> takes it out of every flight without any screen having to
// declare it.
//
// It reads `useHistoryStore` rather than being told where it is. The stack is
// the source, so the rail cannot drift out of step with what the pops actually
// did — press back four times quickly and it unwinds exactly four, because it
// is not counting presses.
function StepRail() {
  const index = useHistoryStore((state) => state.index);
  const t = getDict(useShellLang()).playground.booking;

  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--color-border-light)] bg-[var(--color-bg)] px-4 py-2.5">
      {BOOKING.map((step, position) => {
        const reached = position <= index;

        return (
          <span key={step.id} className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${
                reached ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
              }`}
            />
            {position === index ? (
              <span className="shrink-0 text-[10px] font-bold tracking-[0.06em] text-[var(--color-primary)] uppercase">
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
