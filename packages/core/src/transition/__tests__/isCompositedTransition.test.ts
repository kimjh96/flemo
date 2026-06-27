import { describe, expect, it } from "vitest";

import { isCompositedTransition } from "@transition/compileTransitionStyles";
import createTransition from "@transition/createTransition";
import type { TransitionTarget } from "@transition/cssTypes";
import cupertino from "@transition/cupertino";
import layout from "@transition/layout";
import none from "@transition/none";

const make = (target: TransitionTarget) =>
  createTransition({
    name: "x" as never,
    initial: target,
    idle: { value: { opacity: 1 }, options: { duration: 0 } },
    enter: { value: target, options: { duration: 0.3 } },
    enterBack: { value: target, options: { duration: 0.3 } },
    exit: { value: target, options: { duration: 0.3 } },
    exitBack: { value: target, options: { duration: 0.3 } }
  });

describe("isCompositedTransition", () => {
  it("treats transform/opacity transitions as composited", () => {
    expect(isCompositedTransition(cupertino)).toBe(true); // translateX
    expect(isCompositedTransition(layout)).toBe(true); // opacity + translateY
    expect(isCompositedTransition(make({ scale: 0.8, opacity: 0 }))).toBe(true);
  });

  it("treats a no-animation transition as composited", () => {
    expect(isCompositedTransition(none)).toBe(true);
  });

  it("treats transitions animating non-compositable properties as not composited", () => {
    expect(isCompositedTransition(make({ filter: "blur(12px)", opacity: 0 }))).toBe(false);
    expect(isCompositedTransition(make({ clipPath: "circle(0%)" }))).toBe(false);
    expect(isCompositedTransition(make({ backgroundColor: "rgb(0,0,0)" }))).toBe(false);
  });
});
