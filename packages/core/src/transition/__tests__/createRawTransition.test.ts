import { describe, expect, it } from "vitest";

import createRawTransition from "@transition/createRawTransition";

import type { TransitionTarget } from "@transition/cssTypes";

declare module "@transition/typing" {
  interface RegisterTransition {
    "raw-asym": "raw-asym";
  }
}

const v = (value: TransitionTarget, duration = 0.3) => ({ value, options: { duration } });

describe("createRawTransition", () => {
  // Unlike `createTransition`, the raw factory takes a separate variant for
  // every status/direction pair, so authors can ship a PUSHING-vs-REPLACING
  // shape difference without overloading the higher-level enter/exit.

  const pushOnEnter = v({ x: 0 });
  const pushOnExit = v({ x: -100 });
  const replaceOnEnter = v({ y: 0 });
  const replaceOnExit = v({ y: -50 });
  const popOnEnter = v({ x: "100%" });
  const popOnExit = v({ x: 0 });
  const completedOnEnter = v({ x: 0 });
  const completedOnExit = v({ x: -200 });
  const idle = v({ x: 0 }, 0);

  const subject = () =>
    createRawTransition({
      name: "raw-asym",
      initial: { x: "100%" },
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

  it("PUSHING and REPLACING accept independent enter/exit shapes", () => {
    const t = subject();
    expect(t.variants["PUSHING-true"]).toBe(pushOnEnter);
    expect(t.variants["PUSHING-false"]).toBe(pushOnExit);
    expect(t.variants["REPLACING-true"]).toBe(replaceOnEnter);
    expect(t.variants["REPLACING-false"]).toBe(replaceOnExit);
  });

  it("POPPING and COMPLETED keep their own shapes too", () => {
    const t = subject();
    expect(t.variants["POPPING-true"]).toBe(popOnEnter);
    expect(t.variants["POPPING-false"]).toBe(popOnExit);
    expect(t.variants["COMPLETED-true"]).toBe(completedOnEnter);
    expect(t.variants["COMPLETED-false"]).toBe(completedOnExit);
  });

  it("idle is still mirrored across IDLE-true and IDLE-false", () => {
    const t = subject();
    expect(t.variants["IDLE-true"]).toBe(idle);
    expect(t.variants["IDLE-false"]).toBe(idle);
  });

  it("emits the full 10-variant key set", () => {
    const t = subject();
    expect(Object.keys(t.variants).length).toBe(10);
  });
});
