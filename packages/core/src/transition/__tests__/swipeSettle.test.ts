import { describe, expect, it } from "vitest";

import { MIN_SETTLE_SECONDS, swipeSettleSeconds } from "@transition/swipeSettle";

// The release is the continuation of the gesture: what is LEFT and how fast
// the finger was going decide its length, capped by the transition's own span
// so a swipe never finishes slower than the same motion driven by a button.
describe("swipeSettleSeconds", () => {
  const base = { spanPx: 400, authoredSeconds: 0.7 };

  it("scales with what is left when the finger has stopped", () => {
    // Half the screen still to travel, no momentum: half the authored span.
    expect(swipeSettleSeconds({ ...base, remainingPx: 200, velocityPxPerSecond: 0 })).toBeCloseTo(
      0.35,
      5
    );
    // Barely moved: nearly the whole authored span — which IS the button-driven
    // motion, and the mismatch this replaces (a flat 0.3s either way).
    expect(swipeSettleSeconds({ ...base, remainingPx: 396, velocityPxPerSecond: 0 })).toBeCloseTo(
      0.693,
      3
    );
  });

  it("keeps a flick's momentum instead of slowing it to the authored span", () => {
    // 200px left at 2000px/s wants 0.1s; the floor keeps it visible.
    expect(
      swipeSettleSeconds({ ...base, remainingPx: 200, velocityPxPerSecond: 2000 })
    ).toBeCloseTo(MIN_SETTLE_SECONDS, 5);
    // A moderate flick lands between the two terms.
    expect(
      swipeSettleSeconds({ ...base, remainingPx: 300, velocityPxPerSecond: 1000 })
    ).toBeCloseTo(0.3, 5);
  });

  it("never runs longer than the transition's own span", () => {
    expect(swipeSettleSeconds({ ...base, remainingPx: 4000, velocityPxPerSecond: 0 })).toBeCloseTo(
      0.7,
      5
    );
  });

  it("returns 0 when there is nothing left to travel", () => {
    expect(swipeSettleSeconds({ ...base, remainingPx: 0, velocityPxPerSecond: 800 })).toBe(0);
    expect(swipeSettleSeconds({ ...base, remainingPx: 0.4, velocityPxPerSecond: 0 })).toBe(0);
  });

  it("reads speed and distance sign-agnostically (a y-axis or backward drag)", () => {
    expect(
      swipeSettleSeconds({ ...base, remainingPx: -200, velocityPxPerSecond: -2000 })
    ).toBeCloseTo(MIN_SETTLE_SECONDS, 5);
  });

  it("falls back to the authored span when the axis has no measurable size", () => {
    expect(
      swipeSettleSeconds({
        spanPx: 0,
        authoredSeconds: 0.7,
        remainingPx: 120,
        velocityPxPerSecond: 0
      })
    ).toBeCloseTo(0.7, 5);
  });
});
