"use client";

import { useState } from "react";

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
// Remounting the Router on either change is deliberate — a switch should start
// from a clean stack rather than land mid-flight.
const GROUPS = ["built-in", "authored here"] as const;

function BenchStage() {
  const [choice, setChoice] = useState<PlaygroundChoice>({
    transition: TRANSITIONS[2]!,
    morph: MORPHS[1]!
  });
  const key = `${choice.transition.id}-${choice.morph.id}`;

  return (
    <BenchCard
      title="Every transition, one pair of screens"
      question="Four presets and four transitions written the way a consumer writes them — with the shared element on its own switch, because the two are separate systems that compose."
      controls={
        <div className="flex flex-col gap-3">
          {GROUPS.map((group) => (
            <div key={group} className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.12em] text-[var(--color-text-disabled)] uppercase">
                {group}
              </span>
              <div
                role="radiogroup"
                aria-label={`${group} transitions`}
                className="flex flex-wrap gap-1.5 rounded-2xl bg-[var(--color-bg)] p-1.5"
              >
                {TRANSITIONS.filter((entry) => entry.origin === group).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    role="radio"
                    aria-checked={entry.id === choice.transition.id}
                    onClick={() => setChoice((current) => ({ ...current, transition: entry }))}
                    className={`cursor-pointer rounded-xl px-3.5 py-1.5 font-mono text-[13px] font-semibold transition-colors ${
                      entry.id === choice.transition.id
                        ? "bg-[var(--color-primary)] text-white"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-layer)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.12em] text-[var(--color-text-disabled)] uppercase">
              shared element
            </span>
            <div
              role="radiogroup"
              aria-label="Shared element"
              className="flex flex-wrap gap-1.5 rounded-2xl bg-[var(--color-bg)] p-1.5"
            >
              {MORPHS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={entry.id === choice.morph.id}
                  onClick={() => setChoice((current) => ({ ...current, morph: entry }))}
                  className={`cursor-pointer rounded-xl px-3.5 py-1.5 font-mono text-[13px] font-semibold transition-colors ${
                    entry.id === choice.morph.id
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-layer)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-xs">
            <dt className="text-[var(--color-text-disabled)]">screen</dt>
            <dd className="m-0 leading-relaxed text-[var(--color-text-secondary)]">
              {choice.transition.note}
            </dd>
            <dt className="text-[var(--color-text-disabled)]">element</dt>
            <dd className="m-0 leading-relaxed text-[var(--color-text-secondary)]">
              {choice.morph.note}
            </dd>
          </dl>
        </div>
      }
    >
      <StageFrame marker="playground" caption="Tap a card, then swipe or tap back.">
        <PlaygroundRouter key={key} choice={choice} />
      </StageFrame>
    </BenchCard>
  );
}

export default BenchStage;
