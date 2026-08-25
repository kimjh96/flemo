"use client";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import StageFrame from "../StageFrame";

import ChainRouter from "../../_router/ChainRouter";

import { CHAIN } from "../../_data/chain";

// THE CHAIN, one scroll below the catalog and mirrored: glass on the left, what
// it is on the right. Five pushes, a different transition on each, two of them
// carrying a morph, including one with a camera (`zoom`).
//
// The catalog answers "does this transition work". This answers the question
// only a stack can: does a morph flight leave anything behind for the NEXT
// transition to trip on, and do five pops unwind five different transitions in
// the right order.
function ChainStage() {
  const t = getDict(useShellLang()).playground;

  return (
    <section className="flex min-h-full items-center border-t border-[var(--color-border-light)]">
      <div className="mx-auto grid w-full max-w-[1180px] items-center gap-10 px-6 py-20 lg:grid-cols-[0.95fr_1fr]">
        <div className="order-2 flex justify-center lg:order-1 lg:justify-start">
          <StageFrame marker="chain">
            <ChainRouter />
          </StageFrame>
        </div>

        <div className="order-1 flex flex-col items-start gap-5 lg:order-2">
          <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.1] font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)]">
            {t.chain.title}
          </h2>
          <p className="max-w-[44ch] text-base leading-relaxed text-[var(--color-text-secondary)]">
            {t.chain.question}
          </p>

          <ol className="flex w-full flex-col gap-2">
            {CHAIN.map((step, index) => (
              <li
                key={step.id}
                className="grid grid-cols-[1.25rem_2.5rem_1fr] items-baseline gap-x-3 text-[13px]"
              >
                <span className="font-mono text-[var(--color-text-disabled)] tabular-nums">
                  {index === 0 ? "·" : index}
                </span>
                <span className="font-bold text-[var(--color-text-primary)]">{step.label}</span>
                <span className="font-mono text-[var(--color-text-secondary)]">
                  {index === 0 ? t.chain.root : step.transitionName}
                  {step.morphName ? (
                    <span className="text-[var(--color-primary)]"> + {step.morphName} morph</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>

          <p className="text-xs leading-relaxed text-[var(--color-text-disabled)]">
            {t.chain.caption}
          </p>
        </div>
      </div>
    </section>
  );
}

export default ChainStage;
