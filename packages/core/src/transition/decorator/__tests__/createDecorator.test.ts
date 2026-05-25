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
      enter: v({ opacity: 1 }),
      exit: v({ opacity: 0 })
    });
    expect(d.name).toBe("deco-basic");
    expect(d.initial).toEqual({ opacity: 0 });
  });

  it("enter populates the 'true' side and rest variants except exit-bound", () => {
    const enter = v({ opacity: 1 });
    const exit = v({ opacity: 0 });
    const d = createDecorator({
      name: "deco-basic",
      initial: { opacity: 0 },
      enter,
      exit
    });
    // Decorators don't have a separate "back" direction — both POPPING
    // variants reuse `enter`, and IDLE mirrors `enter` too.
    expect(d.variants["IDLE-true"]).toBe(enter);
    expect(d.variants["IDLE-false"]).toBe(enter);
    expect(d.variants["PUSHING-true"]).toBe(enter);
    expect(d.variants["REPLACING-true"]).toBe(enter);
    expect(d.variants["POPPING-true"]).toBe(enter);
    expect(d.variants["POPPING-false"]).toBe(enter);
    expect(d.variants["COMPLETED-true"]).toBe(enter);
  });

  it("exit populates the 'false' transition-active variants", () => {
    const enter = v({ opacity: 1 });
    const exit = v({ opacity: 0 });
    const d = createDecorator({
      name: "deco-basic",
      initial: { opacity: 0 },
      enter,
      exit
    });
    expect(d.variants["PUSHING-false"]).toBe(exit);
    expect(d.variants["REPLACING-false"]).toBe(exit);
    expect(d.variants["COMPLETED-false"]).toBe(exit);
  });

  it("options spread onto the decorator", () => {
    const onSwipe = () => undefined;
    const d = createDecorator({
      name: "deco-basic",
      initial: {},
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
      enter: v({}),
      exit: v({})
    });
    expect(Object.keys(d.variants).length).toBe(10);
  });
});
