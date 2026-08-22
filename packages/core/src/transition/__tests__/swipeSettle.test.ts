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

  // A cancel walks BACK the way the finger came, and only ever from below the
  // transition's commit threshold — so both terms collapse and the settle used
  // to land on the 0.12s floor every time, snapping an authored curve whose
  // front is loaded (device-reported on Safari after a small drag).
  it("gives a reversal a floor long enough to read as motion", () => {
    const cancelling = {
      remainingPx: 40, // a small drag, which is the only kind that cancels
      spanPx: 390,
      velocityPxPerSecond: 900, // still pushing AWAY from rest
      authoredSeconds: 0.7
    };

    expect(swipeSettleSeconds({ ...cancelling, reversing: true })).toBeCloseTo(0.28, 3);
    // ... and the momentum it cannot borrow is ignored: the same release with
    // a slower finger lands identically.
    expect(
      swipeSettleSeconds({ ...cancelling, velocityPxPerSecond: 60, reversing: true })
    ).toBeCloseTo(0.28, 3);
  });

  it("still honours the authored span as the reversal's ceiling", () => {
    expect(
      swipeSettleSeconds({
        remainingPx: 40,
        spanPx: 390,
        velocityPxPerSecond: 0,
        authoredSeconds: 0.2, // a preset that wants a brisk return
        reversing: true
      })
    ).toBeCloseTo(0.2, 3);
  });

  it("does not lengthen a settle the finger is already carrying home", () => {
    // The finger turned around and is flicking back to rest: that momentum is
    // real, so the release keeps riding it.
    expect(
      swipeSettleSeconds({
        remainingPx: 40,
        spanPx: 390,
        velocityPxPerSecond: 900,
        authoredSeconds: 0.7,
        reversing: false
      })
    ).toBeCloseTo(MIN_SETTLE_SECONDS, 3);
  });
});
