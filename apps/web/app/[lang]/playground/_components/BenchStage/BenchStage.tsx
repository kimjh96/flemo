"use client";

import { useState } from "react";

import { useShellLang } from "@/app/[lang]/_providers/ShellIntlProvider";
import { getDict } from "@/lib/i18n";

import StageFrame from "../StageFrame";

import PlaygroundRouter from "../../_router/PlaygroundRouter";

import {
  MORPHS,
  TRANSITIONS,
  type PlaygroundChoice
} from "../../_providers/TransitionChoiceContext";

// The catalog, laid out like the landing hero: what it is on the left, the
// thing itself on the right, both above the fold. The demo is the argument, so
// it should not be something the visitor has to go looking for.
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
const GROUP = "flex w-fit flex-wrap gap-1.5 rounded-2xl bg-[var(--color-layer)] p-1.5";
const GROUP_LABEL =
  "text-[11px] font-semibold tracking-[0.12em] text-[var(--color-text-disabled)] uppercase";

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
    <section className="flex min-h-full items-center">
      <div className="mx-auto grid w-full max-w-[1180px] items-center gap-10 px-6 pt-24 pb-16 lg:grid-cols-[1fr_0.95fr] lg:pt-28 lg:pb-20">
        <div className="flex flex-col items-start gap-5">
          <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--color-text-primary)] uppercase">
            {t.kicker}
          </span>
          <h1 className="text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.05] font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)]">
            {t.title}
          </h1>
          <p className="max-w-[44ch] text-base leading-relaxed text-[var(--color-text-secondary)]">
            {t.subtitle}
          </p>

          <div className="mt-1 flex w-full flex-col gap-3">
            {groups.map((group) => (
              <div key={group.origin} className="flex flex-col gap-1.5">
                <span className={GROUP_LABEL}>{group.label}</span>
                <div role="radiogroup" aria-label={group.label} className={GROUP}>
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
              <span className={GROUP_LABEL}>{t.bench.element}</span>
              <div role="radiogroup" aria-label={t.bench.element} className={GROUP}>
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
        </div>

        <div className="flex justify-center lg:justify-end">
          <StageFrame marker="playground">
            <PlaygroundRouter key={key} choice={choice} />
          </StageFrame>
        </div>
      </div>
    </section>
  );
}

export default BenchStage;
