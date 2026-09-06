import { describe, expect, it } from "vitest";

import { cubicBezier } from "@transition/cubicBezier";
import {
  authoredTailSeconds,
  MIN_LAUNCH_SLOPE,
  MAX_RELEASE_SPEEDUP,
  MIN_REVERSAL_SECONDS,
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
    // RELEASE_LAUNCH_SLOPE x that, which is 0.16s. That is BELOW the speed
    // ceiling, so the ceiling is what the release actually gets: 2000px/s is
    // well past the band a hand covers, and honouring it there is the defect
    // MAX_RELEASE_SPEEDUP exists to clip (see its note).
    expect(
      swipeSettleSeconds({ ...base, remainingPx: 200, velocityPxPerSecond: 2000 })
    ).toBeCloseTo((0.7 * (200 / 400)) / MAX_RELEASE_SPEEDUP, 5);
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
    ).toBeCloseTo((0.7 * (200 / 400)) / MAX_RELEASE_SPEEDUP, 5);
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
    // "Wherever" is bounded by the speed ceiling: a release may leave at the
    // finger's speed up to MAX_RELEASE_SPEEDUP x the authored average, which
    // on this span and clock is a finger of about 1070 px/s.
    for (const [remaining, velocity] of [
      [270, 800],
      [260, 1000],
      [290, 350]
    ] as const) {
      const { departure } = release(remaining, velocity);
      expect(departure / velocity, `${velocity} px/s`).toBeCloseTo(1, 1);
    }
  });

  it("stops honouring the finger at the ceiling, and departs there instead", () => {
    // Past the ceiling the length is the floor, so the departure is a CONSTANT
    // — `RELEASE_LAUNCH_SLOPE x MAX_RELEASE_SPEEDUP x` the authored average —
    // no matter how hard the flick was or how much is left. That constant is
    // what a swipe now lands at, rather than whatever the pointer stream
    // happened to report.
    const ceiling = (RELEASE_LAUNCH_SLOPE * MAX_RELEASE_SPEEDUP * 390) / 0.7;
    for (const [remaining, velocity] of [
      [240, 1500],
      [230, 2500],
      [300, 6000]
    ] as const) {
      const { departure } = release(remaining, velocity);
      expect(departure, `${velocity} px/s`).toBeCloseTo(ceiling, 0);
      expect(departure, `${velocity} px/s`).toBeLessThan(velocity);
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

  it("puts a reversal on the floor: the screen it starts from is standing still", () => {
    // A cancel's finger was going the OTHER way, so the speed it contributes to
    // the settle's own direction is zero — however hard it was pushing. One
    // rule, not a special case: the release leaves at the speed the SCREEN had.
    for (const velocity of [0, 200, 1200]) {
      expect(
        releaseLaunchSlope({
          remainingPx: 40,
          velocityPxPerSecond: velocity,
          seconds: 0.28,
          reversing: true
        }),
        `${velocity} px/s`
      ).toBeCloseTo(MIN_LAUNCH_SLOPE, 5);
    }
  });

  it("softens a cancel that the authored curve used to throw", () => {
    // The same defect the commit had, at a quarter the magnitude: a screen the
    // finger had brought to a stop still departed at 2.25x its average.
    const REVERSAL_SECONDS = 0.28;
    for (const travelled of [20, 40, 49]) {
      const floored = reaimReleaseEase(
        CUPERTINO,
        releaseLaunchSlope({
          remainingPx: travelled,
          velocityPxPerSecond: 0,
          seconds: REVERSAL_SECONDS,
          reversing: true
        })!
      );
      const before = departureSpeed(CUPERTINO, travelled, REVERSAL_SECONDS);
      const after = departureSpeed(floored, travelled, REVERSAL_SECONDS);
      expect(before / after, `${travelled}px`).toBeCloseTo(4.5, 1);
    }
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

// THE RULE IS THE CONTROLLER'S, NOT ANY PRESET'S.
//
// Every release write in the library passes through one place — a transition's
// own hooks, its decorator's, its parts' — so a curve authored by a consumer
// tomorrow gets the same treatment. What is re-aimed is whatever ease the
// HANDLER passed, and the authored intention is what bounds it.
describe("re-aiming respects whatever curve the transition authored", () => {
  const slopeOf = (ease: readonly [number, number, number, number]) =>
    ease[0] > 0 ? ease[1] / ease[0] : undefined;

  const aim = (
    authored: [number, number, number, number],
    velocityPxPerSecond: number,
    remainingPx = 200,
    seconds = 0.3
  ) => {
    const slope = releaseLaunchSlope({
      remainingPx,
      velocityPxPerSecond,
      seconds,
      authoredSlope: slopeOf(authored)
    })!;
    return { slope, ease: reaimReleaseEase(authored, slope) };
  };

  it("never adds energy to a curve the author drew from rest", () => {
    // material's committing swipe is an ease-IN: it opens at exactly zero, on
    // purpose. A stopped finger must leave it there rather than be floored up.
    const MATERIAL_IN: [number, number, number, number] = [0.4, 0, 1, 1];
    const { slope, ease } = aim(MATERIAL_IN, 0);
    expect(slope).toBe(0);
    expect(ease).toEqual(MATERIAL_IN);
  });

  it("still lets a fast finger leave fast out of that same curve", () => {
    // The ceiling is NOT capped by the authored slope: a screen genuinely
    // moving reads as braking if the settle opens slower than the hand did.
    const { slope } = aim([0.4, 0, 1, 1], 4000);
    expect(slope).toBeCloseTo(RELEASE_LAUNCH_SLOPE, 5);
  });

  it("holds a gently-drawn curve to its own opening when the gesture is slow", () => {
    // The default `ease` opens at 0.4 — below the floor, so the floor yields.
    const { slope } = aim([0.25, 0.1, 0.25, 1], 0);
    expect(slope).toBeCloseTo(0.4, 5);
  });

  it("caps a curve drawn to overshoot at the same ceiling as any other", () => {
    // backOut opens at 4.6. A release is not the place to discover that.
    const { slope, ease } = aim([0.33, 1.53, 0.69, 0.99], 4000);
    expect(slope).toBeCloseTo(RELEASE_LAUNCH_SLOPE, 5);
    // Its landing — the part that overshoots — is the author's and stays.
    expect(ease.slice(2)).toEqual([0.69, 0.99]);
  });

  it("leaves an ease-out alone: it has no opening handle to re-aim", () => {
    const EASE_OUT: [number, number, number, number] = [0, 0, 0.58, 1];
    expect(reaimReleaseEase(EASE_OUT, aim(EASE_OUT, 1200).slope)).toEqual(EASE_OUT);
  });
});

// A curve is CSS. A single NaN in it does not degrade the motion — the browser
// drops the whole `transition` declaration and the screen teleports.
describe("a broken measurement never becomes a broken curve", () => {
  it("declines to re-aim on a non-finite velocity", () => {
    expect(
      releaseLaunchSlope({ remainingPx: 200, velocityPxPerSecond: Number.NaN, seconds: 0.3 })
    ).toBeNull();
    expect(
      releaseLaunchSlope({
        remainingPx: 200,
        velocityPxPerSecond: Number.POSITIVE_INFINITY,
        seconds: 0.3
      })
    ).toBeNull();
  });

  it("declines on a non-finite distance or length", () => {
    expect(
      releaseLaunchSlope({ remainingPx: Number.NaN, velocityPxPerSecond: 900, seconds: 0.3 })
    ).toBeNull();
    expect(
      releaseLaunchSlope({ remainingPx: 200, velocityPxPerSecond: 900, seconds: Number.NaN })
    ).toBeNull();
  });

  it("hands back the authored curve rather than an unparseable one", () => {
    const CUPERTINO: [number, number, number, number] = [0.32, 0.72, 0, 1];
    expect(reaimReleaseEase(CUPERTINO, Number.NaN)).toEqual(CUPERTINO);
    expect(reaimReleaseEase(CUPERTINO, Number.POSITIVE_INFINITY)).toEqual(CUPERTINO);
    for (const value of reaimReleaseEase(CUPERTINO, 1.2)) expect(Number.isFinite(value)).toBe(true);
  });
});

// A CURVE IS NOT A STRAIGHT LINE, and the distance term used to read it as one.
//
// `authored x fraction remaining` is the time a CONSTANT-RATE motion would need.
// cupertino's curve is front-loaded on purpose, so its tail is slow — and the
// claim that a release "lands like the button-driven pop" was measuring a
// straight line against a curve. On a 390px viewport, released with 30% left,
// the button pop covers that last 117px in 0.550s and the release covered it in
// 0.210s: 2.6x faster than the motion it claimed to match, and 6.3x at 90%,
// which is where a swipe-back commit usually happens.
describe("the distance term follows the authored curve's own tail", () => {
  const CUPERTINO: [number, number, number, number] = [0.32, 0.72, 0, 1];
  const SPAN = 390;

  it("gives the last stretch the time the authored motion gives it", () => {
    // 30% left. The authored curve spends 0.550s there; a linear reading said
    // 0.210s.
    expect(authoredTailSeconds(0.7, 0.7, CUPERTINO)).toBeCloseTo(0.55, 2);
    expect(authoredTailSeconds(0.9, 0.7, CUPERTINO)).toBeCloseTo(0.444, 2);
    // The whole motion when nothing has been travelled, nothing when it is done.
    expect(authoredTailSeconds(0, 0.7, CUPERTINO)).toBeCloseTo(0.7, 5);
    expect(authoredTailSeconds(1, 0.7, CUPERTINO)).toBe(0);
  });

  it("is monotone: the further along, the less time is left", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let progress = 0; progress <= 1; progress += 0.05) {
      const seconds = authoredTailSeconds(progress, 0.7, CUPERTINO);
      expect(seconds).toBeLessThanOrEqual(previous + 1e-9);
      previous = seconds;
    }
  });

  it("agrees with the linear reading for a linear curve", () => {
    const LINEAR: [number, number, number, number] = [0, 0, 1, 1];
    expect(authoredTailSeconds(0.7, 0.7, LINEAR)).toBeCloseTo(0.21, 2);
  });

  it("lengthens a slow release without touching a flick's momentum", () => {
    const settle = (velocity: number, remainingPx: number) =>
      swipeSettleSeconds({
        remainingPx,
        spanPx: SPAN,
        velocityPxPerSecond: velocity,
        authoredSeconds: 0.7,
        authoredEase: CUPERTINO
      });

    // 30% left, a finger that had almost stopped: the authored tail, in full.
    expect(settle(200, 117)).toBeCloseTo(0.55, 2);
    // Moving, but not fast: the speed term caps it below the tail.
    expect(settle(600, 117)).toBeCloseTo(0.312, 2);
    // A real flick asks for 0.094s and is given the ceiling instead. It used
    // to bottom out on MIN_SETTLE_SECONDS, which is a floor on TIME and so let
    // a whole screen's worth of travel through in the same 0.12s as the last
    // twenty pixels (see MAX_RELEASE_SPEEDUP).
    expect(settle(2000, 117)).toBeCloseTo((0.7 * (117 / SPAN)) / MAX_RELEASE_SPEEDUP, 5);
  });

  it("does not make a near-complete release sticky", () => {
    // 10% left is 39px. The tail alone would ask for 0.44s, but there is
    // barely any distance and the speed term rules — a landing that crawled
    // here would read as the screen sticking to the finger.
    expect(
      swipeSettleSeconds({
        remainingPx: 39,
        spanPx: SPAN,
        velocityPxPerSecond: 600,
        authoredSeconds: 0.7,
        authoredEase: CUPERTINO
      })
    ).toBeCloseTo(MIN_SETTLE_SECONDS, 5);
  });

  it("keeps the linear reading without a curve, and for a reversal", () => {
    const linearReading = swipeSettleSeconds({
      remainingPx: 117,
      spanPx: SPAN,
      velocityPxPerSecond: 0,
      authoredSeconds: 0.7
    });
    expect(linearReading).toBeCloseTo(0.21, 2);

    // A cancel walks back the way the finger came, which is not a stretch of
    // the authored curve at all — and its own floor already decides its length.
    expect(
      swipeSettleSeconds({
        remainingPx: 40,
        spanPx: SPAN,
        velocityPxPerSecond: 0,
        authoredSeconds: 0.7,
        authoredEase: CUPERTINO,
        reversing: true
      })
    ).toBeCloseTo(MIN_REVERSAL_SECONDS, 5);
  });
});

// THE TAIL IS THE TRANSITION'S, NOT CUPERTINO'S.
//
// The rule reads whatever curve the handler authored, so it moves in BOTH
// directions: a front-loaded curve's tail is slow and its release lengthens, an
// ease-IN accelerates into the end and its release SHORTENS. A linear curve is
// unchanged by construction, which is the sanity check on the whole idea —
// under a constant rate the old reading was already right.
describe("the tail belongs to whatever curve the transition authored", () => {
  const AT = 0.7; // released with 30% left

  it("lengthens a front-loaded release and shortens an ease-in one", () => {
    const linearTail = (seconds: number) => seconds * (1 - AT);

    // cupertino: slowest exactly where a release lands.
    const cupertino = authoredTailSeconds(AT, 0.7, [0.32, 0.72, 0, 1]);
    expect(cupertino / linearTail(0.7)).toBeGreaterThan(2);

    // material's committing swipe is an ease-IN — it is FASTEST at the end, so
    // the same rule gives its release less time, not more.
    const material = authoredTailSeconds(AT, 0.22, [0.4, 0, 1, 1]);
    expect(material / linearTail(0.22)).toBeLessThan(1);
  });

  it("leaves a linear curve exactly where it was", () => {
    for (const progress of [0.25, 0.5, 0.75, 0.9]) {
      expect(authoredTailSeconds(progress, 0.5, [0, 0, 1, 1])).toBeCloseTo(0.5 * (1 - progress), 3);
    }
  });

  it("stays inside the authored duration for any curve, overshooting ones too", () => {
    // backOut's y handles rise above 1, so the inverse is not unique. The
    // search may pick either crossing; what must hold is that it never returns
    // a length outside the motion it came from.
    const CURVES: [number, number, number, number][] = [
      [0.32, 0.72, 0, 1],
      [0.4, 0, 1, 1],
      [0, 0, 0.2, 1],
      [0.25, 0.1, 0.25, 1],
      [0, 0, 1, 1],
      [0.33, 1.53, 0.69, 0.99],
      [0.36, 0, 0.66, -0.56]
    ];
    for (const ease of CURVES) {
      for (const progress of [0, 0.1, 0.5, 0.9, 1]) {
        const seconds = authoredTailSeconds(progress, 0.5, ease);
        expect(Number.isFinite(seconds), `${ease} @ ${progress}`).toBe(true);
        expect(seconds, `${ease} @ ${progress}`).toBeGreaterThanOrEqual(0);
        expect(seconds, `${ease} @ ${progress}`).toBeLessThanOrEqual(0.5);
      }
    }
  });
});
