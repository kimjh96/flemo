"use client";

import { useState } from "react";

import BenchCard from "../BenchCard";
import StageFrame from "../StageFrame";

import PlaygroundRouter from "../../_router/PlaygroundRouter";

import { CHOICES } from "../../_providers/TransitionChoiceContext";

// The fixture's stage. The point of the strip is the claim it tests: a morph is
// NOT coupled to a screen transition, so the same pair of screens is mounted
// under each of them and the element is supposed to cross all four.
//
// Remounting the Router per choice is deliberate — a transition switch should
// start from a clean stack rather than land mid-flight.
function PlaygroundStage() {
  const [choice, setChoice] = useState<string>(CHOICES[0]!.id);
  const active = CHOICES.find((entry) => entry.id === choice) ?? CHOICES[0]!;

  return (
    <BenchCard
      title="One element, any transition"
      question="A morph is not coupled to the screen transition around it. Same two screens, same three layoutIds, mounted under each transition in turn."
      controls={
        <div className="flex flex-col gap-3">
          <div
            role="radiogroup"
            aria-label="Screen transition"
            className="flex flex-wrap gap-1.5 rounded-2xl bg-[var(--color-bg)] p-1.5"
          >
            {CHOICES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={entry.id === choice}
                onClick={() => setChoice(entry.id)}
                className={`cursor-pointer rounded-xl px-3.5 py-1.5 font-mono text-[13px] font-semibold transition-colors ${
                  entry.id === choice
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-layer)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {/* The two variables, named. `sheet` and `zoom` differ by exactly one
              of them, which is the whole point of having both. */}
          <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-xs">
            <dt className="text-[var(--color-text-disabled)]">screen</dt>
            <dd className="m-0 font-mono text-[var(--color-text-secondary)]">
              {active.transitionName}
            </dd>
            <dt className="text-[var(--color-text-disabled)]">morph</dt>
            <dd className="m-0 font-mono text-[var(--color-text-secondary)]">
              {active.morphName ?? "shared"}
            </dd>
            <dt className="text-[var(--color-text-disabled)]">watch</dt>
            <dd className="m-0 leading-relaxed text-[var(--color-text-secondary)]">
              {active.note}
            </dd>
          </dl>
        </div>
      }
    >
      <StageFrame marker="playground" caption="Tap a card, then swipe or tap back.">
        <PlaygroundRouter key={active.id} choice={active} />
      </StageFrame>
    </BenchCard>
  );
}

export default PlaygroundStage;
