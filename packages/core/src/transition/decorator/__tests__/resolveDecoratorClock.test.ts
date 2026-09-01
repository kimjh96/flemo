import { describe, expect, it } from "vitest";

import { compileTransitionStyles } from "@transition/compileTransitionStyles";
import createTransition from "@transition/createTransition";

import type { TransitionName, TransitionVariant } from "@transition/typing";

import createDecorator from "@transition/decorator/createDecorator";
import { resolveDecoratorClock } from "@transition/decorator/resolveDecoratorClock";

import type { DecoratorName } from "@transition/decorator/typing";

declare module "@transition/typing" {
  interface RegisterTransition {
    "clock-long": "clock-long";
    "clock-short": "clock-short";
    "clock-directional": "clock-directional";
  }
}

declare module "@transition/decorator/typing" {
  interface RegisterDecorator {
    "clock-dim": "clock-dim";
    "clock-fixed": "clock-fixed";
  }
}

const slider = (name: TransitionName, seconds: number, decoratorName: DecoratorName) =>
  createTransition({
    name,
    initial: { x: "100%" },
    idle: { value: { x: 0 }, options: { duration: 0 } },
    enter: { value: { x: 0 }, options: { duration: seconds } },
    enterBack: { value: { x: "100%" }, options: { duration: seconds } },
    exit: { value: { x: "-30%" }, options: { duration: seconds } },
    exitBack: { value: { x: 0 }, options: { duration: seconds } },
    options: { decoratorName }
  });

// A dim with NO clock: the whole point of the change.
const dim = createDecorator({
  name: "clock-dim",
  initial: { opacity: 0 },
  idle: { value: { opacity: 0 } },
  enter: { value: { opacity: 1 } },
  exit: { value: { opacity: 0 } }
});

const long = slider("clock-long", 0.7, "clock-dim");
const short = slider("clock-short", 0.3, "clock-dim");

describe("resolveDecoratorClock", () => {
  it("takes the screen's duration for the SAME variant key", () => {
    const resolved = resolveDecoratorClock(long, dim);
    expect(resolved.variants["PUSHING-false"].options?.duration).toBe(0.7);
    expect(resolved.variants["POPPING-false"].options?.duration).toBe(0.7);
  });

  it("gives one decorator two clocks on two transitions", () => {
    expect(resolveDecoratorClock(long, dim).variants["PUSHING-false"].options?.duration).toBe(0.7);
    expect(resolveDecoratorClock(short, dim).variants["PUSHING-false"].options?.duration).toBe(0.3);
  });

  it("carries DIRECTION, because direction is part of the clock", () => {
    // A preset whose push and pop differ hands the dim the same asymmetry
    // without its author restating either number (material runs 0.35 and 0.25).
    const directional = createTransition({
      name: "clock-directional",
      initial: { x: "100%" },
      idle: { value: { x: 0 }, options: { duration: 0 } },
      enter: { value: { x: 0 }, options: { duration: 0.35 } },
      enterBack: { value: { x: "100%" }, options: { duration: 0.25 } },
      exit: { value: { x: "-30%" }, options: { duration: 0.35 } },
      exitBack: { value: { x: 0 }, options: { duration: 0.25 } },
      options: { decoratorName: "clock-dim" }
    });
    const resolved = resolveDecoratorClock(directional, dim);
    expect(resolved.variants["PUSHING-false"].options?.duration).toBe(0.35);
    expect(resolved.variants["POPPING-false"].options?.duration).toBe(0.25);
  });

  it("lets an authored duration win, including a zero and a longer span", () => {
    const fixed = createDecorator({
      name: "clock-fixed",
      initial: { opacity: 0 },
      // A snap the author asked for, which a 0.7s screen must not overwrite.
      idle: { value: { opacity: 0 }, options: { duration: 0 } },
      // A dim deliberately outliving its screen.
      enter: { value: { opacity: 1 }, options: { duration: 3 } },
      exit: { value: { opacity: 0 } }
    });
    const resolved = resolveDecoratorClock(long, fixed);
    expect(resolved.variants["IDLE-true"].options?.duration).toBe(0);
    expect(resolved.variants["PUSHING-false"].options?.duration).toBe(3);
    // ...and the unauthored one still inherits.
    expect(resolved.variants["POPPING-false"].options?.duration).toBe(0.7);
  });

  it("never inherits the screen's EASE", () => {
    const curved = createTransition({
      name: "clock-long",
      initial: { x: "100%" },
      idle: { value: { x: 0 }, options: { duration: 0 } },
      enter: { value: { x: 0 }, options: { duration: 0.7, ease: [0.32, 0.72, 0, 1] } },
      enterBack: { value: { x: "100%" }, options: { duration: 0.7, ease: [0.32, 0.72, 0, 1] } },
      exit: { value: { x: "-30%" }, options: { duration: 0.7, ease: [0.32, 0.72, 0, 1] } },
      exitBack: { value: { x: 0 }, options: { duration: 0.7, ease: [0.32, 0.72, 0, 1] } },
      options: { decoratorName: "clock-dim" }
    });
    const resolved = resolveDecoratorClock(curved, dim);
    expect(resolved.variants["PUSHING-false"].options?.ease).toBeUndefined();
  });
});

describe("the compiled result of a shared decorator", () => {
  const css = compileTransitionStyles([long, short], [dim]);

  const ruleFor = (transitionName: string, variant: TransitionVariant) => {
    const [status, active] = variant.split("-");
    const selector =
      `[data-flemo-decorator][data-flemo-decorator-name="clock-dim"]` +
      `[data-flemo-transition="${transitionName}"]` +
      `[data-flemo-status="${status}"][data-flemo-active="${active}"]`;
    const index = css.indexOf(selector);
    if (index === -1) return undefined;
    return css.slice(index, css.indexOf("}", index) + 1);
  };

  it("emits one rule set per transition, each on its own clock", () => {
    expect(ruleFor("clock-long", "PUSHING-false")).toContain("0.7s");
    expect(ruleFor("clock-short", "PUSHING-false")).toContain("0.3s");
  });

  it("keeps the two apart by keyframe name as well as by selector", () => {
    // Sharing a keyframe name would make the winner depend on source order,
    // which is exactly what the per-name compilation used to do.
    expect(css).toContain("@keyframes flemo-decorator-clock-long--clock-dim-PUSHING-false");
    expect(css).toContain("@keyframes flemo-decorator-clock-short--clock-dim-PUSHING-false");
  });

  it("emits nothing for a decorator no transition names", () => {
    const orphan = createDecorator({
      name: "clock-fixed",
      initial: { opacity: 0 },
      idle: { value: { opacity: 0 } },
      enter: { value: { opacity: 1 } },
      exit: { value: { opacity: 0 } }
    });
    // A decorator element is only ever rendered for a screen whose transition
    // names it, so rules keyed to an unreferenced name could never match.
    expect(compileTransitionStyles([long], [orphan])).not.toContain("clock-fixed");
  });
});
