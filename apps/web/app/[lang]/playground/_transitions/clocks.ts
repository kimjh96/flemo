import type { TransitionName } from "@flemo/react";

// ONE CLOCK FOR EVERY PARTICIPANT.
//
// That phrase is flemo's own, from the `cupertino` preset's header, and it is
// the rule this folder exists to keep.
//
// A screen transition owns a duration and a curve. Three other things move
// during the same flight:
//
//   the shared bar's contents   <Part>
//   the screen's own body copy  <Part>
//   the shared element          <Morph>
//
// A MORPH inherits. `attachMorph` resolves its length as
// `enterMotion.options.duration ?? side.screenDuration`, so a morph that
// authors no duration lands with whatever screen is flying — which is why the
// built-in `shared` and `zoom` presets author a curve and no clock.
//
// A PART DOES NOT. `variantDuration` returns 0 for a missing duration, so an
// omitted clock on a part means "snap", not "inherit". Every part therefore has
// to be authored, which means authored AGAINST a particular transition.
//
// DIRECTION IS PART OF THE CLOCK, and this is the correction that cost a round.
// The first version of this table carried one duration per preset, on the
// assumption that a preset has one length. `material` does not: it enters in
// 0.35s and pops in 0.25s.
//
//   enter      PUSHING-true    0.35   the arrival, on a push
//   exit       PUSHING-false   0.35   the screen going behind it
//   enterBack  POPPING-true    0.25   the dismissal, on a pop
//   exitBack   POPPING-false   0.25   the screen revealed under it
//
// So the split is by DIRECTION, not by side: both screens in a push run 0.35
// and both in a pop run 0.25. A part authored at the push length is therefore
// 40% too slow on every pop — measured by the flight audit as a screen
// animating 0.25s carrying parts running 0.35s, which is the same desync the
// rebuild removed, just one direction narrower.
export interface Beat {
  /** Seconds, matching flemo's transition definition format. */
  duration: number;
  ease: [number, number, number, number];
}

export interface Clock {
  /** What a push (and a replace) runs at. */
  push: Beat;
  /** What a pop runs at. Equal to `push` for every preset except material. */
  pop: Beat;
  /**
   * Whether this transition TRANSLATES its screens. A bar label that slides
   * over a screen that only fades is inventing a direction the flight does not
   * have; one that only fades over a screen carrying a full width reads as
   * unrelated to it. The generated parts branch on this, not the screens.
   */
  slides: boolean;
}

const beat = (duration: number, ease: [number, number, number, number]): Beat => ({
  duration,
  ease
});

const IOS: [number, number, number, number] = [0.32, 0.72, 0, 1];
const STANDARD: [number, number, number, number] = [0.4, 0, 0.2, 1];
const DECELERATE: [number, number, number, number] = [0, 0, 0.2, 1];
const ACCELERATE: [number, number, number, number] = [0.4, 0, 1, 1];

// The built-in rows are COPIES of flemo's own numbers, not guesses. A copy is a
// thing that drifts, so `e2e/clocks.spec.ts` asserts every row against the
// preset it mirrors, in both directions. If flemo retimes a preset the test
// fails there rather than the playground quietly desyncing again.
export const CLOCKS: Record<string, Clock> = {
  // packages/core/src/transition/cupertino.ts — 0.7s on one curve, both ways.
  cupertino: { push: beat(0.7, IOS), pop: beat(0.7, IOS), slides: true },
  // packages/core/src/transition/material.ts — the asymmetric one.
  material: { push: beat(0.35, DECELERATE), pop: beat(0.25, ACCELERATE), slides: true },
  // packages/core/src/transition/layout.ts — 0.4s, no translation.
  layout: { push: beat(0.4, STANDARD), pop: beat(0.4, STANDARD), slides: false },
  // A cut is not a degenerate case to special-case away. Everything riding an
  // instant screen change has to cut with it: a bar that cross-fades over a cut
  // is the same desync inverted.
  none: { push: beat(0, STANDARD), pop: beat(0, STANDARD), slides: false },
  // The two the site authors itself, in the same table as the built-ins on
  // purpose: a consumer's transition is not a second class of thing, and its
  // chrome has to be timed exactly the same way.
  fade: { push: beat(0.34, STANDARD), pop: beat(0.34, STANDARD), slides: false },
  sheet: { push: beat(0.4, STANDARD), pop: beat(0.4, STANDARD), slides: false }
};

export type ClockName = keyof typeof CLOCKS & TransitionName;

export const clockFor = (name: string): Clock => CLOCKS[name] ?? CLOCKS.fade!;

// The names the generated part transitions take. Kept here so the components
// that reference them and the factories that build them cannot drift apart.
export const barPartFor = (name: string) => `bar-${name}`;
export const bodyPartFor = (name: string) => `body-${name}`;
