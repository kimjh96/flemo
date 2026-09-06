import { describe, expect, it } from "vitest";

import type { TransitionTarget } from "@transition/cssTypes";

import createPartTransition from "@transition/partTransition/createPartTransition";

const v = (value: TransitionTarget, duration = 0.3) => ({ value, options: { duration } });

describe("createPartTransition", () => {
  it("returns name + initial unchanged and carries swipe options through", () => {
    const onSwipe = () => {};
    const t = createPartTransition({
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
    const t = createPartTransition({
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

  it("holds idle on the dismissing side when `dismiss` is omitted", () => {
    const idle = v({ opacity: 1 });
    const t = createPartTransition({
      name: "title-fade",
      initial: { opacity: 0 },
      idle,
      enter: v({ opacity: 0 }),
      exit: v({ opacity: 1 })
    });

    // The pre-`dismiss` behaviour, pinned: a part authored without the slot maps
    // exactly as it did before, so adding it broke nothing already published.
    expect(t.variants["POPPING-true"]).toBe(idle);
  });

  it("routes `dismiss` to POPPING-true and leaves every other variant alone", () => {
    const idle = v({ opacity: 1 });
    const enter = v({ opacity: 0 });
    const exit = v({ opacity: 1 });
    const dismiss = v({ opacity: 0 }, 0.12);
    const t = createPartTransition({
      name: "title-fade",
      initial: { opacity: 0 },
      idle,
      enter,
      exit,
      dismiss
    });

    // The screen being popped OFF the stack. It is the ACTIVE side, because
    // `data-flemo-active` follows the stack rather than the direction of travel.
    expect(t.variants["POPPING-true"]).toBe(dismiss);

    // `dismiss` owns one slot and only that slot: the idle-fed variants that are
    // not POPPING-true keep pointing at `idle`.
    for (const variant of [
      "IDLE-true",
      "IDLE-false",
      "PUSHING-true",
      "REPLACING-true",
      "COMPLETED-true"
    ] as const) {
      expect(t.variants[variant]).toBe(idle);
    }
    for (const variant of ["PUSHING-false", "REPLACING-false", "COMPLETED-false"] as const) {
      expect(t.variants[variant]).toBe(enter);
    }
    expect(t.variants["POPPING-false"]).toBe(exit);
  });
});
