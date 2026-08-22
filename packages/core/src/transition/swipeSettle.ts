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
//   - BY DISTANCE: the authored span scaled by the fraction still to travel.
//     A release that is nearly home finishes quickly; one that barely moved
//     takes nearly the whole authored time, which is exactly the button-driven
//     motion the user already knows.
//   - BY SPEED: the time the finger's own speed would need for what is left.
//     A flick keeps its momentum instead of being slowed to the authored span.
//
// The result is clamped: never longer than the authored span (a gesture must
// not end slower than the button), never shorter than MIN_SECONDS (a landing
// the eye cannot follow reads as a cut, not as motion).
export const MIN_SETTLE_SECONDS = 0.12;

export interface SwipeSettleInput {
  // Distance still to travel when the finger lets go, in px.
  remainingPx: number;
  // The full travel the transition is authored over (the viewport axis), in px.
  spanPx: number;
  // The finger's speed along the axis at release, px per second, sign-agnostic.
  velocityPxPerSecond: number;
  // The transition's own duration, in seconds — the ceiling and the reference
  // the distance term scales.
  authoredSeconds: number;
  minSeconds?: number;
}

export const swipeSettleSeconds = ({
  remainingPx,
  spanPx,
  velocityPxPerSecond,
  authoredSeconds,
  minSeconds = MIN_SETTLE_SECONDS
}: SwipeSettleInput): number => {
  const remaining = Math.abs(remainingPx);
  // Nothing to travel: animating zero distance only delays the commit.
  if (remaining <= 0.5) return 0;
  const span = Math.abs(spanPx);
  const byDistance = span > 0 ? authoredSeconds * Math.min(1, remaining / span) : authoredSeconds;
  const speed = Math.abs(velocityPxPerSecond);
  const bySpeed = speed > 0 ? remaining / speed : Number.POSITIVE_INFINITY;
  const chosen = Math.min(byDistance, bySpeed);
  return Math.min(authoredSeconds, Math.max(minSeconds, chosen));
};
