import { describe, expect, it } from "vitest";

import type { TransitionTarget } from "@transition/cssTypes";

import createDecorator from "@transition/decorator/createDecorator";

declare module "@transition/decorator/typing" {
  interface RegisterDecorator {
    "deco-basic": "deco-basic";
  }
}

const v = (value: TransitionTarget, duration = 0.3) => ({ value, options: { duration } });

describe("createDecorator", () => {
  it("returns name + initial unchanged", () => {
    const d = createDecorator({
      name: "deco-basic",
      initial: { opacity: 0 },
      idle: v({ opacity: 0 }, 0),
      enter: v({ opacity: 1 }),
      exit: v({ opacity: 0 })
    });
    expect(d.name).toBe("deco-basic");
    expect(d.initial).toEqual({ opacity: 0 });
  });

  it("idle covers every variant where this decorator should hold its resting position", () => {
    const idle = v({ opacity: 0.1 });
    const enter = v({ opacity: 1 });
    const exit = v({ opacity: 0 });
    const d = createDecorator({
      name: "deco-basic",
      initial: { opacity: 0 },
      idle,
      enter,
      exit
    });
    // Active rest, inactive rest, the *new* screen during PUSH/REPLACE, the
    // active screen leaving on POP, and the active screen settled at
    // COMPLETED, all sit at `idle`. The entering screen MUST land here so
    // overlays don't flash on top of the new screen.
    expect(d.variants["IDLE-true"]).toBe(idle);
    expect(d.variants["IDLE-false"]).toBe(idle);
    expect(d.variants["PUSHING-true"]).toBe(idle);
    expect(d.variants["REPLACING-true"]).toBe(idle);
    expect(d.variants["POPPING-true"]).toBe(idle);
    expect(d.variants["COMPLETED-true"]).toBe(idle);
  });

  it("enter is the target for the screen moving INTO the background (PUSHING/REPLACING-false, COMPLETED-false)", () => {
    const idle = v({ opacity: 0 }, 0);
    const enter = v({ opacity: 1 });
    const exit = v({ opacity: 0 });
    const d = createDecorator({
      name: "deco-basic",
      initial: { opacity: 0 },
      idle,
      enter,
      exit
    });
    expect(d.variants["PUSHING-false"]).toBe(enter);
    expect(d.variants["REPLACING-false"]).toBe(enter);
    expect(d.variants["COMPLETED-false"]).toBe(enter);
  });

  it("exit is the target for the previously-behind screen returning to active (POPPING-false)", () => {
    const idle = v({ opacity: 0 }, 0);
    const enter = v({ opacity: 1 });
    const exit = v({ opacity: 0 });
    const d = createDecorator({
      name: "deco-basic",
      initial: { opacity: 0 },
      idle,
      enter,
      exit
    });
    expect(d.variants["POPPING-false"]).toBe(exit);
  });

  it("options spread onto the decorator", () => {
    const onSwipe = () => undefined;
    const d = createDecorator({
      name: "deco-basic",
      initial: {},
      idle: v({}, 0),
      enter: v({}),
      exit: v({}),
      options: { onSwipe } as unknown as {
        onSwipe: typeof onSwipe;
      }
    });
    expect((d as unknown as { onSwipe: typeof onSwipe }).onSwipe).toBe(onSwipe);
  });

  it("emits 10 variant keys (5 statuses × 2 active)", () => {
    const d = createDecorator({
      name: "deco-basic",
      initial: {},
      idle: v({}, 0),
      enter: v({}),
      exit: v({})
    });
    expect(Object.keys(d.variants).length).toBe(10);
  });
});
