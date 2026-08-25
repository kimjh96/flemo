"use client";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import BenchCard from "../BenchCard";
import StageFrame from "../StageFrame";

import ChainRouter from "../../_router/ChainRouter";

import { CHAIN } from "../../_data/chain";

// THE CHAIN. Five pushes, a different transition on each, two of them carrying
// a morph, including one with a camera (`zoom`). The strip beside it answers
// "does this transition work"; this answers the question that only a stack can:
// does a morph flight leave anything behind for the NEXT transition to trip on,
// and do five pops unwind five different transitions in the right order.
function ChainStage() {
  const t = getDict(useShellLang()).playground;

  return (
    <BenchCard
      title={t.chain.title}
      question={t.chain.question}
      controls={
        <ol className="flex flex-col gap-1.5">
          {CHAIN.map((step, index) => (
            <li
              key={step.id}
              className="grid grid-cols-[1.25rem_3rem_1fr] items-baseline gap-x-3 text-xs"
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
      }
    >
      <StageFrame marker="chain" caption={t.chain.caption}>
        <ChainRouter />
      </StageFrame>
    </BenchCard>
  );
}

export default ChainStage;
