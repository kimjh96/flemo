import { describe, expect, it } from "vitest";

import type { TransitionTarget } from "@transition/cssTypes";

import createBarTransition from "@transition/barTransition/createBarTransition";

const v = (value: TransitionTarget, duration = 0.3) => ({ value, options: { duration } });

describe("createBarTransition", () => {
  it("returns name + initial unchanged and carries swipe options through", () => {
    const onSwipe = () => {};
    const t = createBarTransition({
      name: "title-fade",
      initial: { opacity: 0 },
      idle: v({ opacity: 1 }, 0),
      enter: v({ opacity: 0 }),
      exit: v({ opacity: 1 }),
      options: { onSwipe }
    });
    expect(t.name).toBe("title-fade");
    expect(t.initial).toEqual({ opacity: 0 });
    expect(t.onSwipe).toBe(onSwipe);
  });

  it("maps idle / enter / exit onto the 8 status×active variants", () => {
    const idle = v({ opacity: 1 });
    const enter = v({ opacity: 0 });
    const exit = v({ opacity: 0.5 });
    const t = createBarTransition({
      name: "title-fade",
      initial: { opacity: 0 },
      idle,
      enter,
      exit
    });

    // idle: active rest, inactive rest, the entering side of push/replace, the
    // leaving top on pop, and the active screen settled.
    for (const variant of [
      "IDLE-true",
      "IDLE-false",
      "PUSHING-true",
      "REPLACING-true",
      "POPPING-true",
      "COMPLETED-true"
    ] as const) {
      expect(t.variants[variant]).toBe(idle);
    }

    // enter: the screen dropping into the background.
    for (const variant of ["PUSHING-false", "REPLACING-false", "COMPLETED-false"] as const) {
      expect(t.variants[variant]).toBe(enter);
    }

    // exit: the previously-behind screen returning to active on pop.
    expect(t.variants["POPPING-false"]).toBe(exit);
  });
});
