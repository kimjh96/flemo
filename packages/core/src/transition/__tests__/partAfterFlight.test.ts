import { describe, expect, it } from "vitest";

import createRawTransition from "@transition/createRawTransition";

import createPartTransition from "@transition/partTransition/createPartTransition";
import { resolvePartClock } from "@transition/partTransition/resolvePartClock";

// A LENGTH THE PART CANNOT WRITE DOWN.
//
// Chrome that a flight covers has to wait exactly as long as the flight and is
// revealed at its landing. The flight's length belongs to whichever transition
// is carrying it, so writing it in the part is writing one part per transition
// plus a table of their durations — which is what this repository's own
// playground had: eight rows, hand-copied from six sources, and a case with no
// row got no part at all (the `chrome-tether` incident).
const screen = (duration: number, delay = 0) =>
  createRawTransition({
    name: `flight-${duration}-${delay}` as never,
    initial: {},
    idle: { value: {}, options: { duration: 0 } },
    pushOnEnter: { value: { x: 0 }, options: { duration, delay } },
    pushOnExit: { value: { x: 0 }, options: { duration, delay } },
    replaceOnEnter: { value: { x: 0 }, options: { duration, delay } },
    replaceOnExit: { value: { x: 0 }, options: { duration, delay } },
    popOnEnter: { value: { x: 0 }, options: { duration, delay } },
    popOnExit: { value: { x: 0 }, options: { duration, delay } },
    completedOnEnter: { value: { x: 0 }, options: { duration, delay } },
    completedOnExit: { value: { x: 0 }, options: { duration, delay } }
  });

const chrome = (options: Record<string, unknown>) =>
  createPartTransition({
    name: "chrome",
    initial: { opacity: 0 },
    idle: { value: { opacity: 1 }, options: options as never },
    enter: { value: { opacity: 1 }, options: { duration: 0 } },
    exit: { value: { opacity: 1 }, options: { duration: 0 } }
  });

describe("a part that starts after the flight", () => {
  it("waits for whichever transition is carrying it", () => {
    const part = chrome({ duration: 0.32, after: "flight" });
    const slow = resolvePartClock(screen(0.7), part).variants["PUSHING-true"];
    const quick = resolvePartClock(screen(0.35), part).variants["PUSHING-true"];
    expect(slow.options.delay).toBeCloseTo(0.7);
    expect(quick.options.delay).toBeCloseTo(0.35);
    // Its own length is still its own.
    expect(slow.options.duration).toBeCloseTo(0.32);
  });

  it("counts the flight's own delay as part of the wait", () => {
    const part = chrome({ duration: 0.2, after: "flight" });
    const resolved = resolvePartClock(screen(0.4, 0.1), part).variants["PUSHING-true"];
    expect(resolved.options.delay).toBeCloseTo(0.5);
  });

  it("adds an authored delay on top rather than replacing it", () => {
    const part = chrome({ duration: 0.2, after: "flight", delay: 0.04 });
    const resolved = resolvePartClock(screen(0.4), part).variants["PUSHING-true"];
    expect(resolved.options.delay).toBeCloseTo(0.44);
  });

  it("is zero for a flight that is zero, so a cut stays a cut", () => {
    const part = chrome({ duration: 0.32, after: "flight" });
    const resolved = resolvePartClock(screen(0), part).variants["PUSHING-true"];
    expect(resolved.options.delay).toBe(0);
  });

  it("leaves a part that does not ask for it inheriting as before", () => {
    const part = chrome({ duration: 0.2 });
    const resolved = resolvePartClock(screen(0.4, 0.1), part).variants["PUSHING-true"];
    expect(resolved.options.delay).toBeCloseTo(0.1);
  });
});
