"use client";

import { useState } from "react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import BenchCard from "../BenchCard";
import StageFrame from "../StageFrame";

import PlaygroundRouter from "../../_router/PlaygroundRouter";

import {
  MORPHS,
  TRANSITIONS,
  type PlaygroundChoice
} from "../../_providers/TransitionChoiceContext";

// The catalog bench: every transition on one pair of screens, with the shared
// element as a SEPARATE switch.
//
// Two axes rather than a list of pre-mixed cases, because that is the claim
// being tested. A morph is not coupled to the screen transition around it, so
// turning the element off has to leave a working transition behind, and
// switching the transition has to leave a working morph. Anything that only
// works in one combination shows up here as an empty cell.
//
// Remounting the Router on either change is deliberate: a switch should start
// from a clean stack rather than land mid-flight.
const PILL =
  "cursor-pointer rounded-xl px-3.5 py-1.5 font-mono text-[13px] font-semibold transition-colors";
const PILL_ON = "bg-[var(--color-primary)] text-white";
const PILL_OFF =
  "text-[var(--color-text-secondary)] hover:bg-[var(--color-layer)] hover:text-[var(--color-text-primary)]";

function BenchStage() {
  const t = getDict(useShellLang()).playground;
  const [choice, setChoice] = useState<PlaygroundChoice>({
    transition: TRANSITIONS[2]!,
    morph: MORPHS[1]!
  });
  const key = `${choice.transition.id}-${choice.morph.id}`;

  const groups = [
    { origin: "built-in" as const, label: t.bench.builtIn },
    { origin: "authored here" as const, label: t.bench.authored }
  ];

  return (
    <BenchCard
      title={t.bench.title}
      question={t.bench.question}
      controls={
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.origin} className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.12em] text-[var(--color-text-disabled)] uppercase">
                {group.label}
              </span>
              <div
                role="radiogroup"
                aria-label={group.label}
                className="flex flex-wrap gap-1.5 rounded-2xl bg-[var(--color-bg)] p-1.5"
              >
                {TRANSITIONS.filter((entry) => entry.origin === group.origin).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    role="radio"
                    aria-checked={entry.id === choice.transition.id}
                    onClick={() => setChoice((current) => ({ ...current, transition: entry }))}
                    className={`${PILL} ${entry.id === choice.transition.id ? PILL_ON : PILL_OFF}`}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.12em] text-[var(--color-text-disabled)] uppercase">
              {t.bench.element}
            </span>
            <div
              role="radiogroup"
              aria-label={t.bench.element}
              className="flex flex-wrap gap-1.5 rounded-2xl bg-[var(--color-bg)] p-1.5"
            >
              {MORPHS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={entry.id === choice.morph.id}
                  onClick={() => setChoice((current) => ({ ...current, morph: entry }))}
                  className={`${PILL} ${entry.id === choice.morph.id ? PILL_ON : PILL_OFF}`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-xs">
            <dt className="text-[var(--color-text-disabled)]">{t.bench.screenLabel}</dt>
            <dd className="m-0 leading-relaxed text-[var(--color-text-secondary)]">
              {t.transitions[choice.transition.id]}
            </dd>
            <dt className="text-[var(--color-text-disabled)]">{t.bench.elementLabel}</dt>
            <dd className="m-0 leading-relaxed text-[var(--color-text-secondary)]">
              {t.morphs[choice.morph.id]}
            </dd>
          </dl>
        </div>
      }
    >
      <StageFrame marker="playground" caption={t.bench.caption}>
        <PlaygroundRouter key={key} choice={choice} />
      </StageFrame>
    </BenchCard>
  );
}

export default BenchStage;
