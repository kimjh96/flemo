"use client";

import { useHistoryStore } from "@flemo/react";

import { CHAIN } from "../../_data/chain";

// The stack, drawn beside the stack.
//
// Chrome of the Router, outside the <Slot>: five marks that fill as the stack
// deepens and empty as it unwinds. It is the same structural move the browse
// bench's header makes — a thing that must not travel with the screens does not
// live among them — and here it is doing the job a rail does in a real app,
// telling you where in a flow you are while the flow moves underneath.
//
// It reads `useHistoryStore` rather than being told: the stack is the source,
// so the rail cannot drift out of step with what the pops are actually doing.
function StepRail() {
  const index = useHistoryStore((state) => state.index);

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border-light)] bg-[var(--color-bg)] px-4 py-2">
      {CHAIN.map((step, position) => {
        const reached = position <= index;
        return (
          <span key={step.id} className="flex flex-1 items-center gap-2">
            <span
              className={`h-1 flex-1 rounded-full transition-colors ${
                reached ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
              }`}
            />
            <span
              className={`font-mono text-[10px] ${
                position === index
                  ? "text-[var(--color-primary)]"
                  : "text-[var(--color-text-disabled)]"
              }`}
            >
              {step.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default StepRail;
