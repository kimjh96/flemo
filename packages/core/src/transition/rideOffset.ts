import type { TransitionTarget } from "@transition/cssTypes";

// A RIDE-ALONG element runs the SCREEN's transition on its OWN box, and that is
// where a percentage offset betrays it: `translate` resolves a percentage
// against the border box of the element being translated, not against the box
// the author had in mind.
//
// Only one rider's box differs from its screen's, and only on one axis.
// <Layer> hosts and slots are `inset: 0`, so both of their axes match. A shared
// bar is laid out at `width: 100%` against the same box the screen fills, so
// its WIDTH matches too and every horizontal transition has been right all
// along — cupertino's `x: "100%"` is the same distance on either box. A bar is
// only ever as TALL as its own content, so `y` is the axis that lies, and it is
// the only one corrected here: rewriting `x` as well would double the compiled
// sheet to restate a length that is already equal.
//
// Under material's `y: "100%"` a 104px bar travelled 104px while its 770px
// screen travelled 770px: same clock, same easing, one seventh of the distance.
// Measured on a 588x770 window, 9% into the flight, the bar was 94px from home
// and the screen was 700px from home, so the bar landed at the top of a screen
// still off the bottom of the viewport and read as a detached strip over the
// outgoing screen.
//
// The repair keeps the ride-along contract intact — one clock, one easing, one
// compositor — and only restates what "100%" means for a bar: the binding
// measures the screen box and publishes its height here, and the bar's keyframe
// copy multiplies that length instead of its own.
export const RIDE_HEIGHT_VAR = "--flemo-ride-y";

const PERCENT = /^\s*(-?\d*\.?\d+)%\s*$/;

// The fraction a percentage length represents, or null when the value is not a
// bare percentage (`0`, `-56`, `12px`, `calc(...)` all pass through untouched).
export const percentRatio = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const match = PERCENT.exec(value);
  if (!match) return null;
  const ratio = Number(match[1]) / 100;
  return Number.isFinite(ratio) ? ratio : null;
};

// The CSS length a bar must translate for an authored percentage. The fallback
// keeps the value identical to the screen's for any element that never receives
// the custom property, so a bar whose box was not published behaves exactly as
// it did before this rule existed.
//
// The var() lives in the BAR's keyframes only; the screen's stay literal. That
// is deliberate: this repository has already lost WebKit's accelerated playback
// once to custom properties in animation TIMING (2026-08-13), so the flagship
// path keeps nothing that could repeat it. Keyframe VALUES were re-measured for
// this change on both engines (chromium and webkit, video captured while the
// main thread was blocked for 1500ms mid-flight): a literal box and a
// `calc(var(...))` box advanced within 1px of each other through the whole
// block, 3 runs each, so the value form composites. Re-run that probe before
// widening this to timing or to the screen scope.
export const rideLength = (ratio: number): string => {
  const basis = `var(${RIDE_HEIGHT_VAR}, 100%)`;
  if (ratio === 1) return basis;
  if (ratio === -1) return `calc(${basis} * -1)`;
  return `calc(${basis} * ${ratio})`;
};

// The imperative half, for the swipe controller's synchronous mirror: a drag
// writes inline styles rather than keyframes, so the percentage is resolved
// against the measured screen box right here instead of through a custom
// property. Same axis, same reason. Values that are not percentages, and every
// property other than `y`, pass through untouched.
export const resolveRideTarget = <T extends TransitionTarget>(
  target: T,
  screenHeight: number
): T => {
  const ratio = percentRatio(target.y);
  if (ratio === null || !(screenHeight > 0)) return target;
  return { ...target, y: `${screenHeight * ratio}px` };
};
