import { describe, expect, it } from "vitest";

import type { TransitionTarget } from "@transition/cssTypes";

import createRawPartTransition from "@transition/partTransition/createRawPartTransition";

const v = (value: TransitionTarget, duration = 0.3) => ({ value, options: { duration } });

describe("createRawPartTransition", () => {
  it("maps each enter/exit slot to its own status×active variant key", () => {
    const idle = v({ opacity: 0 }, 0);
    const pushOnEnter = v({ opacity: 1 });
    const pushOnExit = v({ opacity: 0.2 });
    const replaceOnEnter = v({ opacity: 0.5 });
    const replaceOnExit = v({ opacity: 0.6 });
    const popOnEnter = v({ opacity: 0.8 });
    const popOnExit = v({ opacity: 0.9 });
    const completedOnEnter = v({ opacity: 1 });
    const completedOnExit = v({ opacity: 0 });

    const t = createRawPartTransition({
      name: "raw-bar",
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

    expect(t.name).toBe("raw-bar");
    expect(t.variants["IDLE-true"]).toBe(idle);
    expect(t.variants["IDLE-false"]).toBe(idle);
    expect(t.variants["PUSHING-true"]).toBe(pushOnEnter);
    expect(t.variants["PUSHING-false"]).toBe(pushOnExit);
    expect(t.variants["REPLACING-true"]).toBe(replaceOnEnter);
    expect(t.variants["REPLACING-false"]).toBe(replaceOnExit);
    expect(t.variants["POPPING-true"]).toBe(popOnEnter);
    expect(t.variants["POPPING-false"]).toBe(popOnExit);
    expect(t.variants["COMPLETED-true"]).toBe(completedOnEnter);
    expect(t.variants["COMPLETED-false"]).toBe(completedOnExit);
  });

  it("carries swipe options through", () => {
    const onSwipe = () => {};
    const t = createRawPartTransition({
      name: "raw-bar",
      initial: { opacity: 0 },
      idle: v({ opacity: 0 }),
      pushOnEnter: v({ opacity: 1 }),
      pushOnExit: v({ opacity: 0 }),
      replaceOnEnter: v({ opacity: 1 }),
      replaceOnExit: v({ opacity: 0 }),
      popOnEnter: v({ opacity: 1 }),
      popOnExit: v({ opacity: 0 }),
      completedOnEnter: v({ opacity: 1 }),
      completedOnExit: v({ opacity: 0 }),
      options: { onSwipe }
    });
    expect(t.onSwipe).toBe(onSwipe);
  });
});
