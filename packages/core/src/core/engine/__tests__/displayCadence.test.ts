import { afterEach, describe, expect, it } from "vitest";

import {
  learnedFrameIntervalMs,
  reportDisplayIntervalMs,
  resetDisplayCadenceForTests
} from "@core/engine/displayCadence";

// The session's learned display cadence. One number, fed by the engine's
// in-flight rAF probe and read by the compiled tier's landing governor.
//
// Its whole job is to be TRUSTWORTHY: a reading taken at the wrong moment (a
// stall, an idle window, measurement noise) must not move it, because the
// consumer of a wrong reading is motion the user sees.

afterEach(resetDisplayCadenceForTests);

describe("reportDisplayIntervalMs", () => {
  it("seeds at 60Hz nominal", () => {
    expect(learnedFrameIntervalMs()).toBeCloseTo(1000 / 60, 3);
  });

  it("accepts a genuine high-refresh reading", () => {
    reportDisplayIntervalMs(1000 / 120);
    expect(learnedFrameIntervalMs()).toBeCloseTo(1000 / 120, 3);
  });

  it("ignores a non-finite sample", () => {
    reportDisplayIntervalMs(1000 / 120);
    reportDisplayIntervalMs(Number.NaN);
    reportDisplayIntervalMs(Number.POSITIVE_INFINITY);
    expect(learnedFrameIntervalMs()).toBeCloseTo(1000 / 120, 3);
  });

  it("ignores measurement noise below the floor", () => {
    // Under ~1.7ms is not a display, it is a bad clock read.
    reportDisplayIntervalMs(0.5);
    expect(learnedFrameIntervalMs()).toBeCloseTo(1000 / 60, 3);
  });

  it("ignores a stall above the ceiling, but admits a real 30Hz cadence", () => {
    // A 100ms gap is a blocked main thread, not a slow panel — taking it would
    // tell the governor the display is slower than it is.
    reportDisplayIntervalMs(100);
    expect(learnedFrameIntervalMs()).toBeCloseTo(1000 / 60, 3);
    // ~33ms every frame IS a cadence (low-power throttling), and it is
    // admitted — but never raises the estimate above 60Hz nominal.
    reportDisplayIntervalMs(33);
    expect(learnedFrameIntervalMs()).toBeCloseTo(1000 / 60, 3);
  });

  it("never reports faster than the floor it accepts", () => {
    reportDisplayIntervalMs(1000 / 600);
    expect(learnedFrameIntervalMs()).toBeCloseTo(1000 / 600, 3);
  });
});

describe("resetDisplayCadenceForTests", () => {
  it("puts the session-scoped state back to its seed", () => {
    reportDisplayIntervalMs(1000 / 120);
    expect(learnedFrameIntervalMs()).toBeLessThan(12);
    resetDisplayCadenceForTests();
    expect(learnedFrameIntervalMs()).toBeCloseTo(1000 / 60, 3);
  });
});
