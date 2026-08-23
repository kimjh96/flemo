// How long the motion AFTER a swipe lets go should take.
//
// A release is the continuation of a gesture, not a fresh transition: what is
// left to travel and how fast the finger was going are the two facts that
// decide it. A fixed duration ignores both — cupertino's release ran 0.3s
// whether the finger had 6px or 300px left, which is why a swipe-completed pop
// finished in a different time (and read as a different motion) from the same
// pop driven by a button, whose authored span is 0.7s.
//
// Two candidate lengths, and the shorter wins:
//   - BY DISTANCE: the time the AUTHORED CURVE ITSELF spends covering the
//     stretch that is left. A release that is nearly home finishes quickly; one
//     that barely moved takes nearly the whole authored time.
//
//     This used to be `authored x fraction remaining`, which assumes the
//     authored motion travels at a CONSTANT rate. It does not — cupertino's
//     curve is front-loaded on purpose, so its tail is slow, and the claim that
//     a release "lands like the button-driven pop" was measuring a straight
//     line against a curve. On a 390px viewport, released with 30% left:
//
//       the button pop covers that last 117px in   0.550s   (213 px/s)
//       the release covered it in                  0.210s   (557 px/s)
//
//     2.6x faster than the motion it claimed to match, and worse the closer to
//     the end the finger let go — 6.3x at 90%, which is where a swipe-back
//     commit usually happens. Device-reported on Safari as still too whippy
//     after the curve itself had been fixed: the same mistake as the curve bug,
//     one level up. A decelerating motion read as a linear one.
//   - BY SPEED: the time the finger's own speed would need for what is left,
//     paid out along a DECELERATING curve. A flick keeps its momentum instead
//     of being slowed to the authored span.
//
// The result is clamped: never longer than the authored span (a gesture must
// not end slower than the button), never shorter than MIN_SECONDS (a landing
// the eye cannot follow reads as a cut, not as motion).
export const MIN_SETTLE_SECONDS = 0.12;

// THE CURVE MATTERS AS MUCH AS THE LENGTH, and for a while only the length was
// being computed.
//
// A duration is an AVERAGE speed. What the eye reads at the instant the finger
// leaves is the curve's speed at t=0, and an authored transition curve is
// front-loaded because it starts from REST: cupertino's
// cubic-bezier(0.32, 0.72, 0, 1) opens at 0.72/0.32 = 2.25x its own average.
// Run that curve on a release and the screen does not continue the gesture, it
// is THROWN — measured against the finger's own speed at the moment it let go,
// on a 390px viewport:
//
//   finger      settle    speed at release    vs the finger
//   150 px/s    0.556s    1254 px/s           8.4x
//   350 px/s    0.521s    1254 px/s           3.6x
//   800 px/s    0.338s    1800 px/s           2.3x
//   1500 px/s   0.160s    3375 px/s           2.3x
//
// Every release accelerated away from the hand that made it, worst where the
// gesture was gentlest — device-reported on Safari as "휙휙", too whippy at any
// drag speed and worse when fast. The duration work (2026-08) had assumed a
// linear payout and left the curve alone, and its own commit message noted the
// curve "reads wider than it measures" without following the thread.
//
// So the release gets a curve of its own, built to LEAVE AT THE SPEED THE
// FINGER HAD. Its x handles stay the authored ones (so it is the same family
// of motion, and stays a valid CSS timing function); only the first y handle
// moves, to put the initial slope where the gesture left it.
//
// This is NOT the retired front-softening (see compileTransitionStyles.ts). That
// one softened the authored curve of a BUTTON-driven transition, which starts
// from rest and whose front-loading is the point; it was prescribed against a
// broken pipeline and read as a different transition once the pipeline was
// fixed. Nothing here touches a compiled keyframe or a navigation that no
// finger started.

/**
 * The initial slope a release curve is allowed to reach, as a multiple of its
 * own average speed — the ceiling on "the finger was going fast".
 *
 * It is also what the by-speed length is derived from: a curve that starts at
 * the finger's speed and decelerates to rest covers the remaining distance in
 * `slope x remaining / speed`, not `remaining / speed`. The old formula solved
 * for a motion that never slows down, which no landing does.
 */
export const RELEASE_LAUNCH_SLOPE = 1.6;

/**
 * The floor on that slope. A very slow drag with most of the screen left
 * cannot be honored literally — matching 150 px/s over 310px would take two
 * seconds — so the settle does accelerate away from it. It leaves at half its
 * average rather than at 2.25x, which is the difference between the system
 * taking over and the screen being snatched.
 */
export const MIN_LAUNCH_SLOPE = 0.5;

// A RELEASE THAT REVERSES THE FINGER gets its own, longer floor.
//
// Both terms above assume the settle CONTINUES the gesture. A cancel does the
// opposite: it walks back the way the finger came. The speed term then reads
// backwards — the harder you pushed away from rest, the shorter the return —
// and the distance term collapses, because a cancel only happens BELOW the
// transition's commit threshold and so never has far to travel (cupertino
// commits at 50px, so every cancel asks for 0.7s x 50/390 = 0.09s and lands on
// the floor). Both together made every cancelled swipe a 0.12s snap of an
// authored curve whose front is loaded — device-reported on Safari as "it just
// jumps back" after a small drag, where the same cancel used to run the
// preset's own 0.3s.
//
// So a reversal ignores the speed it cannot borrow and lands no faster than
// this — still capped by the authored span, so a transition that wants a brisk
// return only has to author one.
//
// Its CURVE is not a special case, though: a reversal contributes zero speed in
// the settle's own direction, so the one rule below puts it on the floor. Under
// the authored curve a screen the finger had brought to a STOP still departed
// at 2.25x its average — the same defect the commit had, at a quarter the size.
export const MIN_REVERSAL_SECONDS = 0.28;

export interface SwipeSettleInput {
  // Distance still to travel when the finger lets go, in px.
  remainingPx: number;
  // The full travel the transition is authored over (the viewport axis), in px.
  spanPx: number;
  // The finger's speed along the axis at release, px per second, sign-agnostic.
  velocityPxPerSecond: number;
  // Whether the settle travels AGAINST the gesture (a cancel walking back to
  // rest while the finger was pushing away, or standing still). A settle that
  // continues the finger is not a reversal, even when it is a cancel — a
  // finger already flicking back toward rest lends its momentum like any
  // other.
  reversing?: boolean;
  // The transition's own duration, in seconds — the ceiling and the reference
  // the distance term scales.
  authoredSeconds: number;
  /**
   * The authored curve's control points. Given them, the distance term is the
   * time that curve itself spends on the stretch that is left; without them it
   * falls back to reading the motion as linear, which is what this used to do
   * for every transition.
   */
  authoredEase?: readonly [number, number, number, number];
  minSeconds?: number;
}

/**
 * How long the authored curve takes to travel its LAST `1 - progress` — the
 * stretch a release that let go at `progress` still has to cover.
 *
 * The curve maps time to distance, so this inverts it: find the time at which
 * it has covered `progress`, and return what is left of the duration. Both
 * searches are on a monotone function.
 */
export const authoredTailSeconds = (
  progress: number,
  authoredSeconds: number,
  ease: readonly [number, number, number, number]
): number => {
  if (!(progress > 0)) return authoredSeconds;
  if (progress >= 1) return 0;
  const [x1, y1, x2, y2] = ease;
  const sampleX = (u: number) => 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3;
  const sampleY = (u: number) => 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u * u * y2 + u ** 3;
  // Solve for the parameter where the curve has covered `progress` of its
  // travel, then read the time (x) there.
  let low = 0;
  let high = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (sampleY(mid) < progress) low = mid;
    else high = mid;
  }
  const timeFraction = sampleX((low + high) / 2);
  return authoredSeconds * Math.min(1, Math.max(0, 1 - timeFraction));
};

export const swipeSettleSeconds = ({
  remainingPx,
  spanPx,
  velocityPxPerSecond,
  authoredSeconds,
  authoredEase,
  reversing = false,
  minSeconds = reversing ? MIN_REVERSAL_SECONDS : MIN_SETTLE_SECONDS
}: SwipeSettleInput): number => {
  const remaining = Math.abs(remainingPx);
  // Nothing to travel: animating zero distance only delays the commit.
  if (remaining <= 0.5) return 0;
  const span = Math.abs(spanPx);
  const remainingFraction = span > 0 ? Math.min(1, remaining / span) : 1;
  // A REVERSAL keeps the linear reading: it walks back the way the finger came,
  // which is not a stretch of the authored curve at all, and its own floor
  // already decides its length. The user judged that motion right as it is.
  const byDistance =
    authoredEase && !reversing
      ? authoredTailSeconds(1 - remainingFraction, authoredSeconds, authoredEase)
      : authoredSeconds * remainingFraction;
  const speed = Math.abs(velocityPxPerSecond);
  // A reversal has no momentum to inherit: the finger was going the other way.
  //
  // The factor is what makes this the time a DECELERATING landing needs. At
  // `remaining / speed` the settle only lasts that long if it never slows down,
  // so the curve had to open well above the finger to arrive on time — which is
  // the throw this term used to produce.
  const bySpeed =
    !reversing && speed > 0 ? (RELEASE_LAUNCH_SLOPE * remaining) / speed : Number.POSITIVE_INFINITY;
  const chosen = Math.min(byDistance, bySpeed);
  return Math.min(authoredSeconds, Math.max(minSeconds, chosen));
};

/**
 * The release curve's normalized initial slope: the speed the settle leaves at,
 * as a multiple of its own average. `velocity x seconds / remaining` is exactly
 * the finger's speed expressed in those units.
 *
 * ONE RULE, INCLUDING THE CANCEL. A reversal's finger was going the other way,
 * so the speed it contributes to the settle's own direction is not its own
 * speed — it is zero or less. Zero is what this reads it as, which puts every
 * reversal on the floor: the screen is standing still when the settle begins,
 * and it opens like something standing still.
 *
 * Full velocity continuity for a reversal would mean OVERSHOOT — the screen
 * carrying on the way the finger was pushing for a hair before it returns,
 * which is what a real spring does. That is a different primitive, not a
 * re-aimed bezier, and it is deliberately not attempted here. Clamping at zero
 * is the closest a monotone curve gets.
 */
export const releaseLaunchSlope = ({
  remainingPx,
  velocityPxPerSecond,
  seconds,
  authoredSlope,
  reversing = false
}: {
  remainingPx: number;
  velocityPxPerSecond: number;
  seconds: number;
  /**
   * The opening slope the transition's author drew. The floor never rises
   * above it: a release that the gesture cannot support must not come out
   * HARDER than the authored motion — the floor is there to stop a crawl, not
   * to add energy the author did not ask for. The ceiling is not capped this
   * way; a finger genuinely moving fast should leave fast, even out of a curve
   * drawn to open gently, or the screen reads as braking the moment it is let
   * go.
   */
  authoredSlope?: number;
  reversing?: boolean;
}): number | null => {
  const remaining = Math.abs(remainingPx);
  if (!Number.isFinite(remaining) || remaining <= 0.5) return null;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  // A non-finite velocity would propagate into the curve and produce
  // `cubic-bezier(NaN, …)` — invalid CSS, which the browser drops WHOLE, taking
  // the transition with it and teleporting the screen. Fall back to no
  // re-aiming rather than to a broken declaration.
  if (!reversing && !Number.isFinite(velocityPxPerSecond)) return null;
  const fingerSlope = reversing ? 0 : (Math.abs(velocityPxPerSecond) * seconds) / remaining;
  // `>= 0`, not `> 0`: an authored ease-IN opens at exactly zero — material's
  // committing swipe is cubic-bezier(0.4, 0, 1, 1) — and that is a drawn
  // intention, not a missing value. Reading it as absent handed the floor a
  // curve the author had deliberately started from rest.
  const floor =
    typeof authoredSlope === "number" && authoredSlope >= 0
      ? Math.min(MIN_LAUNCH_SLOPE, authoredSlope)
      : MIN_LAUNCH_SLOPE;
  return Math.min(RELEASE_LAUNCH_SLOPE, Math.max(floor, fingerSlope));
};

/**
 * Re-aim an authored cubic-bezier so it LEAVES at `slope` times its average
 * speed, keeping its x handles and its landing.
 *
 * Only `y1` moves. `x1`/`x2` are the authored ones, so the result is still a
 * valid CSS timing function by construction (x monotonicity is a property of
 * the x handles alone) and still lands the way the transition's author drew it
 * — the release differs from the authored curve exactly where the gesture
 * differs from a standing start, and nowhere else.
 *
 * `y1` is capped below 1 so the curve cannot overshoot its own target; where a
 * steep slope would need more, `x1` shrinks to buy it instead.
 */
export const reaimReleaseEase = (
  authored: readonly [number, number, number, number],
  slope: number
): [number, number, number, number] => {
  const [x1, y1, x2, y2] = authored;
  // A curve with no horizontal room at the start has no slope to re-aim — and a
  // non-finite one would spell an invalid `cubic-bezier`, which is worse than
  // any curve at all.
  if (!Number.isFinite(slope) || x1 <= 0 || slope <= 0) return [x1, y1, x2, y2];
  const MAX_Y1 = 0.95;
  const aimedX1 = Math.min(x1, MAX_Y1 / slope);
  return [aimedX1, Math.min(MAX_Y1, slope * aimedX1), x2, y2];
};
