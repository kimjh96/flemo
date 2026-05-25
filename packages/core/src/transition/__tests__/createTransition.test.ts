import { describe, expect, it } from "vitest";

import createTransition from "@transition/createTransition";

import type { TransitionTarget } from "@transition/cssTypes";

declare module "@transition/typing" {
  interface RegisterTransition {
    "ct-basic": "ct-basic";
    "ct-options-spread": "ct-options-spread";
    "ct-asymmetric": "ct-asymmetric";
  }
}

const makeVariant = (value: TransitionTarget, duration = 0.3) => ({
  value,
  options: { duration }
});

describe("createTransition", () => {
  it("returns the literal name and initial target unchanged", () => {
    const t = createTransition({
      name: "ct-basic",
      initial: { x: "100%" },
      idle: makeVariant({ x: 0 }, 0),
      enter: makeVariant({ x: 0 }),
      enterBack: makeVariant({ x: "100%" }),
      exit: makeVariant({ x: -100 }),
      exitBack: makeVariant({ x: 0 })
    });
    expect(t.name).toBe("ct-basic");
    expect(t.initial).toEqual({ x: "100%" });
  });

  it("idle is mirrored across both IDLE-true and IDLE-false variants", () => {
    const idle = makeVariant({ x: 0 }, 0);
    const t = createTransition({
      name: "ct-basic",
      initial: { x: "100%" },
      idle,
      enter: makeVariant({ x: 0 }),
      enterBack: makeVariant({ x: "100%" }),
      exit: makeVariant({ x: -100 }),
      exitBack: makeVariant({ x: 0 })
    });
    expect(t.variants["IDLE-true"]).toBe(idle);
    expect(t.variants["IDLE-false"]).toBe(idle);
  });

  it("enter feeds PUSHING-true, REPLACING-true, and COMPLETED-true", () => {
    const enter = makeVariant({ x: 0 });
    const t = createTransition({
      name: "ct-basic",
      initial: { x: "100%" },
      idle: makeVariant({ x: 0 }, 0),
      enter,
      enterBack: makeVariant({ x: "100%" }),
      exit: makeVariant({ x: -100 }),
      exitBack: makeVariant({ x: 0 })
    });
    expect(t.variants["PUSHING-true"]).toBe(enter);
    expect(t.variants["REPLACING-true"]).toBe(enter);
    expect(t.variants["COMPLETED-true"]).toBe(enter);
  });

  it("exit feeds PUSHING-false, REPLACING-false, and COMPLETED-false", () => {
    const exit = makeVariant({ x: -100 });
    const t = createTransition({
      name: "ct-basic",
      initial: { x: "100%" },
      idle: makeVariant({ x: 0 }, 0),
      enter: makeVariant({ x: 0 }),
      enterBack: makeVariant({ x: "100%" }),
      exit,
      exitBack: makeVariant({ x: 0 })
    });
    expect(t.variants["PUSHING-false"]).toBe(exit);
    expect(t.variants["REPLACING-false"]).toBe(exit);
    expect(t.variants["COMPLETED-false"]).toBe(exit);
  });

  it("enterBack maps to POPPING-true and exitBack maps to POPPING-false", () => {
    const enterBack = makeVariant({ x: "100%" });
    const exitBack = makeVariant({ x: 0 });
    const t = createTransition({
      name: "ct-asymmetric",
      initial: { x: "100%" },
      idle: makeVariant({ x: 0 }, 0),
      enter: makeVariant({ x: 0 }),
      enterBack,
      exit: makeVariant({ x: -100 }),
      exitBack
    });
    expect(t.variants["POPPING-true"]).toBe(enterBack);
    expect(t.variants["POPPING-false"]).toBe(exitBack);
  });

  it("options spread onto the transition (decoratorName + swipe-handler triplet)", () => {
    const onSwipeStart = async () => true;
    const onSwipe = () => 0;
    const onSwipeEnd = async () => false;
    const t = createTransition({
      name: "ct-options-spread",
      initial: { x: "100%" },
      idle: makeVariant({ x: 0 }, 0),
      enter: makeVariant({ x: 0 }),
      enterBack: makeVariant({ x: "100%" }),
      exit: makeVariant({ x: -100 }),
      exitBack: makeVariant({ x: 0 }),
      options: { decoratorName: "overlay", swipeDirection: "x", onSwipeStart, onSwipe, onSwipeEnd }
    });
    expect(t.decoratorName).toBe("overlay");
    // Narrow the union by witnessing `swipeDirection`, then the swipe-handler
    // properties become directly accessible on `t`.
    if (t.swipeDirection === "x") {
      expect(t.onSwipeStart).toBe(onSwipeStart);
      expect(t.onSwipe).toBe(onSwipe);
      expect(t.onSwipeEnd).toBe(onSwipeEnd);
    } else {
      throw new Error("Expected swipeDirection to be 'x'");
    }
  });

  it("emits all 10 variant keys (5 statuses × 2 active flags)", () => {
    const t = createTransition({
      name: "ct-basic",
      initial: {},
      idle: makeVariant({}),
      enter: makeVariant({}),
      enterBack: makeVariant({}),
      exit: makeVariant({}),
      exitBack: makeVariant({})
    });
    expect(Object.keys(t.variants).sort()).toEqual(
      [
        "COMPLETED-false",
        "COMPLETED-true",
        "IDLE-false",
        "IDLE-true",
        "POPPING-false",
        "POPPING-true",
        "PUSHING-false",
        "PUSHING-true",
        "REPLACING-false",
        "REPLACING-true"
      ].sort()
    );
  });

  it("does not mutate the input variant objects", () => {
    const enter = makeVariant({ x: 0 });
    const frozen = Object.freeze({ ...enter });
    expect(() =>
      createTransition({
        name: "ct-basic",
        initial: {},
        idle: makeVariant({}),
        enter: frozen as typeof enter,
        enterBack: makeVariant({}),
        exit: makeVariant({}),
        exitBack: makeVariant({})
      })
    ).not.toThrow();
  });
});
