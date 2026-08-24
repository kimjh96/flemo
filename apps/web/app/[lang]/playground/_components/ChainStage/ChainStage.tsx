"use client";

import ChainRouter from "../../_router/ChainRouter";

import { CHAIN } from "../../_data/chain";

// THE CHAIN. Five pushes, a different transition on each, two of them carrying
// a morph — including one with a camera (`zoom`). The strip above answers
// "does this transition work"; this answers the question that only a stack can:
// does a morph flight leave anything behind for the NEXT transition to trip on,
// and do five pops unwind five different transitions in the right order.
function ChainStage() {
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-6 pb-20">
      <header>
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
          Transition chain
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          One stack, five transitions, two of them morphs. Walk it down and pop it back.
        </p>
        <ol className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-disabled)]">
          {CHAIN.map((step) => (
            <li key={step.id}>
              <span className="font-bold text-[var(--color-text-secondary)]">{step.label}</span>{" "}
              {step.transitionName}
              {step.morphName ? ` + ${step.morphName} morph` : ""}
            </li>
          ))}
        </ol>
      </header>

      <div className="flex justify-center">
        <div
          className="relative h-[720px] w-[380px] overflow-hidden rounded-[34px] border border-[var(--color-border-light)] shadow-[0_34px_80px_-26px_rgba(15,23,42,0.35)]"
          data-chain-stage=""
        >
          <ChainRouter />
        </div>
      </div>
    </div>
  );
}

export default ChainStage;
