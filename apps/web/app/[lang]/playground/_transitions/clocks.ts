import type { TransitionName } from "@flemo/react";

// ONE CLOCK FOR EVERY PARTICIPANT.
//
// That phrase is flemo's own, from the `cupertino` preset's header, and it is
// the rule the previous playground broke. It is worth stating plainly, because
// the break was invisible in code review and obvious the moment it was
// measured.
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
// authors no duration lands with whatever screen is flying — that is why the
// built-in `shared` and `zoom` presets deliberately author a curve and no
// clock.
//
// A PART DOES NOT. `variantDuration` returns 0 for a missing duration, so an
// omitted clock means "snap", not "inherit". Every part transition therefore
// has to be authored, which means it has to be authored AGAINST a particular
// screen transition.
//
// The old playground authored one bar part at 0.34s and let the bench switch
// the screen transition underneath it at runtime. Measured on a cupertino push
// (0.7s): the outgoing title was at 28% opacity 90ms in and the incoming one at
// 97% by 200ms, while the screens still had half their travel left. The bar
// finished, then the screens kept going. That is what "the header breaks" and
// "the transition is choppy" actually were — not a missing hand-over, but a
// hand-over on the wrong clock.
//
// So the clock is not a constant here. It is a TABLE keyed by the screen
// transition, and every part the app authors is generated from it. Change a
// preset's timing in one place and the bar, the body copy and the element all
// follow, because they are all reading the same row.
export interface Clock {
  /** Seconds, matching flemo's transition definition format. */
  duration: number;
  ease: [number, number, number, number];
  /**
   * Whether this transition TRANSLATES its screens. A bar label that slides
   * over a screen that only fades is inventing a direction the flight does not
   * have; one that only fades over a screen carrying a full width reads as
   * unrelated to it. The generated parts branch on this, not the screens.
   */
  slides: boolean;
}

// The built-in rows are COPIES of flemo's own numbers, not guesses:
//   cupertino  packages/core/src/transition/cupertino.ts  0.7s  [0.32, 0.72, 0, 1]
//   material   packages/core/src/transition/material.ts   0.35s enter / 0.25s exit
//   layout     packages/core/src/transition/layout.ts     0.4s
//   none       an instant cut, so every participant cuts with it
//
// A copy is a thing that can drift, so the suite beside this file asserts each
// row against the preset it mirrors. If flemo retimes a preset, the test fails
// here rather than the playground quietly desyncing again.
export const CLOCKS: Record<string, Clock> = {
  cupertino: { duration: 0.7, ease: [0.32, 0.72, 0, 1], slides: true },
  // Material's enter and exit differ (0.35s / 0.25s). The parts ride the
  // ARRIVAL, which is the longer of the two and the one the eye is following.
  material: { duration: 0.35, ease: [0, 0, 0.2, 1], slides: true },
  layout: { duration: 0.4, ease: [0.4, 0, 0.2, 1], slides: false },
  // Zero is not a degenerate case to special-case away. A cut is a legitimate
  // flight, and everything riding it has to cut too: a bar that cross-fades
  // over an instant screen change is the same desync as before, inverted.
  none: { duration: 0, ease: [0.4, 0, 0.2, 1], slides: false },
  // The two the site authors itself. They are in the same table as the
  // built-ins on purpose: a consumer's transition is not a second class of
  // thing, and its chrome has to be timed exactly the same way.
  fade: { duration: 0.34, ease: [0.4, 0, 0.2, 1], slides: false },
  sheet: { duration: 0.4, ease: [0.4, 0, 0.2, 1], slides: false }
};

export type ClockName = keyof typeof CLOCKS & TransitionName;

export const clockFor = (name: string): Clock => CLOCKS[name] ?? CLOCKS.fade!;

// The names the generated part transitions take. Kept here so the components
// that reference them and the factories that build them cannot drift apart.
export const barPartFor = (name: string) => `bar-${name}`;
export const bodyPartFor = (name: string) => `body-${name}`;
