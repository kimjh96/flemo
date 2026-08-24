"use client";

import { useState } from "react";

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
    <div className="mx-auto flex min-h-dvh max-w-[1100px] flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
          Morph playground
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          One <code>layoutId</code>, two screens. Pick a screen transition and watch what the shared
          element does under it.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {CHOICES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setChoice(entry.id)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              entry.id === choice
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-layer)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {entry.label}
          </button>
        ))}
        <span className="text-xs text-[var(--color-text-disabled)]">{active.note}</span>
      </div>

      <div className="flex justify-center">
        <div
          className="relative h-[720px] w-[380px] overflow-hidden rounded-[34px] border border-[var(--color-border-light)] shadow-[0_34px_80px_-26px_rgba(15,23,42,0.35)]"
          data-playground-stage=""
        >
          <PlaygroundRouter key={active.id} choice={active} />
        </div>
      </div>
    </div>
  );
}

export default PlaygroundStage;
