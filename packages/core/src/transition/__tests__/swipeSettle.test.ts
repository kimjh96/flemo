import { describe, expect, it } from "vitest";

import { cubicBezier } from "@transition/cubicBezier";
import {
  MIN_LAUNCH_SLOPE,
  MIN_SETTLE_SECONDS,
  RELEASE_LAUNCH_SLOPE,
  reaimReleaseEase,
  releaseLaunchSlope,
  swipeSettleSeconds
} from "@transition/swipeSettle";

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
    // 200px left at 2000px/s. The finger would cross it in 0.1s AT A CONSTANT
    // SPEED — but a landing decelerates, so the time it actually needs is
    // RELEASE_LAUNCH_SLOPE x that. Solving for less is what forced the curve to
    // open above the finger to arrive on time.
    expect(
      swipeSettleSeconds({ ...base, remainingPx: 200, velocityPxPerSecond: 2000 })
    ).toBeCloseTo(0.16, 5);
    // A moderate flick still lands between the two terms.
    expect(
      swipeSettleSeconds({ ...base, remainingPx: 300, velocityPxPerSecond: 1000 })
    ).toBeCloseTo(0.48, 5);
    // And the floor still catches a release with almost nothing left.
    expect(swipeSettleSeconds({ ...base, remainingPx: 20, velocityPxPerSecond: 3000 })).toBeCloseTo(
      MIN_SETTLE_SECONDS,
      5
    );
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
    ).toBeCloseTo(0.16, 5);
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

// THE CURVE, not just the length.
//
// The duration decides the settle's AVERAGE speed. What the eye reads at the
// instant the finger leaves is the curve's speed at t=0 — and an authored
// transition curve opens fast because it starts from REST. Running it on a
// release threw the screen away from the hand that made it: on a 390px
// viewport, 1.7x the finger's speed at a hard flick and 8.4x at a gentle drag.
describe("the release curve leaves at the speed the finger had", () => {
  const CUPERTINO: [number, number, number, number] = [0.32, 0.72, 0, 1];

  /** Speed of the settle at t=0, in px/s — the number the eye actually reads. */
  const departureSpeed = (
    ease: readonly [number, number, number, number],
    remainingPx: number,
    seconds: number
  ) => {
    const curve = cubicBezier(...(ease as [number, number, number, number]));
    const dt = 1e-5;
    return (curve(dt / seconds) * remainingPx) / dt;
  };

  const release = (remainingPx: number, velocityPxPerSecond: number) => {
    const seconds = swipeSettleSeconds({
      remainingPx,
      spanPx: 390,
      velocityPxPerSecond,
      authoredSeconds: 0.7
    });
    const slope = releaseLaunchSlope({ remainingPx, velocityPxPerSecond, seconds });
    const ease = slope === null ? CUPERTINO : reaimReleaseEase(CUPERTINO, slope);
    return { seconds, ease, departure: departureSpeed(ease, remainingPx, seconds) };
  };

  it("departs at the finger's own speed wherever the gesture can be honoured", () => {
    for (const [remaining, velocity] of [
      [270, 800],
      [240, 1500],
      [230, 2500],
      [290, 350]
    ] as const) {
      const { departure } = release(remaining, velocity);
      expect(departure / velocity, `${velocity} px/s`).toBeCloseTo(1, 1);
    }
  });

  it("no longer throws the screen — the old release did, at every speed", () => {
    // The motion this replaces, reconstructed: the authored curve run over a
    // length solved for a constant payout (`remaining / speed`).
    const oldRelease = (remainingPx: number, velocityPxPerSecond: number) => {
      const seconds = Math.min(
        0.7,
        Math.max(
          MIN_SETTLE_SECONDS,
          Math.min((0.7 * remainingPx) / 390, remainingPx / velocityPxPerSecond)
        )
      );
      return departureSpeed(CUPERTINO, remainingPx, seconds);
    };

    for (const [remaining, velocity] of [
      [310, 150],
      [290, 350],
      [270, 800],
      [240, 1500]
    ] as const) {
      const before = oldRelease(remaining, velocity);
      const { departure } = release(remaining, velocity);
      expect(before / velocity, `before @ ${velocity} px/s`).toBeGreaterThan(1.6);
      expect(departure, `after @ ${velocity} px/s`).toBeLessThan(before);
      expect(departure / velocity, `after @ ${velocity} px/s`).toBeLessThan(2.5);
    }
  });

  it("still accelerates away from a crawl, rather than taking two seconds", () => {
    // 150 px/s with 310px left cannot be honoured literally. It leaves at half
    // its average instead of 2.25x it — the system taking over, not a snatch.
    const { departure } = release(310, 150);
    expect(departure / 150).toBeLessThan(2.5);
    expect(departure).toBeGreaterThan(150);
  });

  it("keeps the authored curve for a reversal, which has no momentum to match", () => {
    expect(
      releaseLaunchSlope({
        remainingPx: 40,
        velocityPxPerSecond: 200,
        seconds: 0.28,
        reversing: true
      })
    ).toBeNull();
  });

  it("returns no slope when there is nothing to travel or no time to travel it", () => {
    expect(
      releaseLaunchSlope({ remainingPx: 0.4, velocityPxPerSecond: 900, seconds: 0.3 })
    ).toBeNull();
    expect(
      releaseLaunchSlope({ remainingPx: 200, velocityPxPerSecond: 900, seconds: 0 })
    ).toBeNull();
  });

  it("clamps the slope to the band, both ends", () => {
    expect(
      releaseLaunchSlope({ remainingPx: 200, velocityPxPerSecond: 20_000, seconds: 0.3 })
    ).toBeCloseTo(RELEASE_LAUNCH_SLOPE, 5);
    expect(
      releaseLaunchSlope({ remainingPx: 200, velocityPxPerSecond: 1, seconds: 0.3 })
    ).toBeCloseTo(MIN_LAUNCH_SLOPE, 5);
  });

  it("re-aims only the opening, keeping the landing the author drew", () => {
    const aimed = reaimReleaseEase(CUPERTINO, 0.8);
    expect(aimed[2]).toBe(CUPERTINO[2]);
    expect(aimed[3]).toBe(CUPERTINO[3]);
    expect(aimed[1] / aimed[0]).toBeCloseTo(0.8, 5);
    // x1 is the authored one until a steep slope needs room for itself.
    expect(aimed[0]).toBe(CUPERTINO[0]);
  });

  it("buys a steep slope with x1 rather than letting y1 overshoot", () => {
    const aimed = reaimReleaseEase([0.9, 0.1, 0.2, 1], 4);
    expect(aimed[1]).toBeLessThanOrEqual(0.95);
    expect(aimed[1] / aimed[0]).toBeCloseTo(4, 5);
    expect(aimed[0]).toBeLessThan(0.9);
  });

  it("leaves a curve with no opening handle alone", () => {
    expect(reaimReleaseEase([0, 0, 0.58, 1], 1.2)).toEqual([0, 0, 0.58, 1]);
  });
});
