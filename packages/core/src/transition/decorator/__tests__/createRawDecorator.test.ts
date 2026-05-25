import { describe, expect, it } from "vitest";

import type { TransitionTarget } from "@transition/cssTypes";

import createRawDecorator from "@transition/decorator/createRawDecorator";

declare module "@transition/decorator/typing" {
  interface RegisterDecorator {
    "raw-deco": "raw-deco";
  }
}

const v = (value: TransitionTarget, duration = 0.3) => ({ value, options: { duration } });

describe("createRawDecorator", () => {
  it("maps each enter/exit slot to its own variant key", () => {
    const idle = v({ opacity: 0 }, 0);
    const pushOnEnter = v({ opacity: 1 });
    const pushOnExit = v({ opacity: 0.2 });
    const replaceOnEnter = v({ opacity: 0.5 });
    const replaceOnExit = v({ opacity: 0.6 });
    const popOnEnter = v({ opacity: 0.8 });
    const popOnExit = v({ opacity: 0.9 });
    const completedOnEnter = v({ opacity: 1 });
    const completedOnExit = v({ opacity: 0 });

    const d = createRawDecorator({
      name: "raw-deco",
      initial: { opacity: 0 },
      idle,
      pushOnEnter,
      pushOnExit,
      replaceOnEnter,
      replaceOnExit,
      popOnEnter,
      popOnExit,
      completedOnEnter,
      completedOnExit
    });

    expect(d.variants["IDLE-true"]).toBe(idle);
    expect(d.variants["IDLE-false"]).toBe(idle);
    expect(d.variants["PUSHING-true"]).toBe(pushOnEnter);
    expect(d.variants["PUSHING-false"]).toBe(pushOnExit);
    expect(d.variants["REPLACING-true"]).toBe(replaceOnEnter);
    expect(d.variants["REPLACING-false"]).toBe(replaceOnExit);
    expect(d.variants["POPPING-true"]).toBe(popOnEnter);
    expect(d.variants["POPPING-false"]).toBe(popOnExit);
    expect(d.variants["COMPLETED-true"]).toBe(completedOnEnter);
    expect(d.variants["COMPLETED-false"]).toBe(completedOnExit);
  });

  it("emits the full 10-variant key set", () => {
    const d = createRawDecorator({
      name: "raw-deco",
      initial: {},
      idle: v({}),
      pushOnEnter: v({}),
      pushOnExit: v({}),
      replaceOnEnter: v({}),
      replaceOnExit: v({}),
      popOnEnter: v({}),
      popOnExit: v({}),
      completedOnEnter: v({}),
      completedOnExit: v({})
    });
    expect(Object.keys(d.variants).length).toBe(10);
  });
});
