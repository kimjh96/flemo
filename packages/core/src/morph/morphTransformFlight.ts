import { easingToCss } from "@transition/compileTransitionStyles";
import type { AnimationOptions } from "@transition/cssTypes";
import { cubicBezier, type EasingFunction } from "@transition/cubicBezier";

import type { MorphClipInset } from "@morph/morphClip";
import type { MorphRect } from "@morph/morphGeometry";

// THE TRANSFORM-MODE FLIGHT: a window that grows, on the compositor's clock.
//
// Box mode animates layout and re-lays the subtree at every size — the richest
// reading of "it grows", and main-thread by nature. This builder is the other
// contract (`mode: "transform"` on the morph transition): the flight is staged
// at its DESTINATION geometry inside a runtime WRAPPER, and only transforms
// animate.
//
//   wrapper   overflow:hidden box at the destination rect, travelling by
//             translate3d+scale from the origin rect to identity. Its box IS
//             the window: the clip region is the box in wrapper-local space,
//             so the rendered clip is the scaled box — exactly the
//             interpolating window box mode showed, without a single layout.
//   element   inside, at destination geometry, counter-scaled so its contents
//             hold natural size while the window grows over them.
//
// BOTH transforms are emitted as SAMPLED stops with linear segments rather
// than two-stop eased keyframes. The wrapper's scale and the element's inverse
// must multiply to one at every frame; CSS interpolates each animation
// independently, and the reciprocal of an eased lerp is not an eased lerp. At
// matching linear stops the product is exactly one, and between stops the
// deviation is second-order in the step — invisible at 4% steps.
//
// The travel keyframes carry transforms and NOTHING else, deliberately: WebKit
// accelerates an animation only when every property in it is compositable,
// and splitting is the trembling this mode exists to end. The window's corner
// and the surface channels ride a separate two-stop paint animation on the
// wrapper — main-thread, like every paint — with the corner's LOCAL values
// pre-divided by the endpoint scales so the rendered corner is circular at
// both ends of a non-uniformly scaled window.

const STOPS = 25;

// The sampler needs the curve as a FUNCTION, whatever form the author wrote
// it in. Keywords map to their CSS control points (the same reading
// `easingToCss` gives the emitted string), and the fallbacks match its
// fallbacks, so the sampled stops follow exactly the curve every other
// animation in the flight runs on.
const toEasing = (ease: AnimationOptions["ease"] | undefined): EasingFunction => {
  if (Array.isArray(ease) && ease.length === 4 && ease.every((n) => typeof n === "number")) {
    const [x1, y1, x2, y2] = ease as unknown as [number, number, number, number];
    return cubicBezier(x1, y1, x2, y2);
  }
  if (ease === "linear") return (progress: number) => progress;
  const named: Record<string, [number, number, number, number]> = {
    easeIn: [0.42, 0, 1, 1],
    easeOut: [0, 0, 0.58, 1],
    easeInOut: [0.42, 0, 0.58, 1],
    circIn: [0, 0.55, 0.45, 1],
    circOut: [0.55, 0, 1, 0.45],
    backIn: [0.31, 0.01, 0.66, -0.59],
    backOut: [0.33, 1.53, 0.69, 0.99],
    anticipate: [0.36, 0, 0.66, -0.56]
  };
  const points = (typeof ease === "string" && named[ease]) || [0.25, 0.1, 0.25, 1];
  return cubicBezier(points[0], points[1], points[2], points[3]);
};

const round = (value: number): number => Math.round(value * 10000) / 10000;
const px = (value: number) => `${Math.round(value * 100) / 100}px`;

export interface TransformFlightSet {
  rules: string[];
  /** The wrapper's animation list; its travel is the flight's landing clock. */
  wrapperAnimation: string;
  /** The element's counter-scale animation, and its name — the same span as
   * the travel, so either end is a sound landing clock, and this one fires on
   * the element the landing already listens to. */
  counterAnimation: string;
  counterName: string;
  geometryName: string;
}

export const buildTransformFlight = (input: {
  id: string;
  /** Layer-space rects for the two ends of the flight. */
  origin: MorphRect;
  destination: MorphRect;
  duration: number;
  start: number;
  ease: AnimationOptions["ease"] | undefined;
  /** Paint channels for the window — corner already converted by the caller. */
  paint: { property: string; from: string; to: string }[];
  clip: { from: MorphClipInset; to: MorphClipInset } | null;
}): TransformFlightSet => {
  const { id, origin, destination, duration, start, ease, paint, clip } = input;
  const easing = toEasing(ease);
  const sx0 = destination.width > 0 ? origin.width / destination.width : 1;
  const sy0 = destination.height > 0 ? origin.height / destination.height : 1;
  const dx0 = origin.x - destination.x;
  const dy0 = origin.y - destination.y;

  const rules: string[] = [];
  const timing = `${duration.toFixed(3)}s linear ${start.toFixed(3)}s both`;

  const travelName = `flemo-morph-${id}w-travel`;
  const counterName = `flemo-morph-${id}c-counter`;
  const travelStops: string[] = [];
  const counterStops: string[] = [];
  for (let i = 0; i <= STOPS; i++) {
    const p = i / STOPS;
    const e = easing(p);
    const sx = sx0 + (1 - sx0) * e;
    const sy = sy0 + (1 - sy0) * e;
    const dx = dx0 * (1 - e);
    const dy = dy0 * (1 - e);
    const offset = `${round(p * 100)}%`;
    travelStops.push(
      `  ${offset} { transform: translate3d(${px(dx)}, ${px(dy)}, 0) scale(${round(sx)}, ${round(sy)}); }`
    );
    counterStops.push(`  ${offset} { transform: scale(${round(1 / sx)}, ${round(1 / sy)}); }`);
  }
  rules.push(`@keyframes ${travelName} {\n${travelStops.join("\n")}\n}`);
  rules.push(`@keyframes ${counterName} {\n${counterStops.join("\n")}\n}`);

  const animations: string[] = [`${travelName} ${timing}`];

  const insetCss = (inset: MorphClipInset): string =>
    `inset(${inset.top.toFixed(2)}% ${inset.right.toFixed(2)}% ${inset.bottom.toFixed(2)}% ${inset.left.toFixed(2)}%)`;
  const paintDecls = (channels: { property: string; value: string }[]): string =>
    channels.map((channel) => `    ${channel.property}: ${channel.value};`).join("\n");
  const from: { property: string; value: string }[] = paint.map((channel) => ({
    property: channel.property,
    value: channel.from
  }));
  const to: { property: string; value: string }[] = paint.map((channel) => ({
    property: channel.property,
    value: channel.to
  }));
  if (clip) {
    from.push({ property: "clip-path", value: insetCss(clip.from) });
    to.push({ property: "clip-path", value: insetCss(clip.to) });
  }
  if (from.length > 0) {
    const paintName = `flemo-morph-${id}w-paint`;
    rules.push(
      `@keyframes ${paintName} {\n  from {\n${paintDecls(from)}\n  }\n  to {\n${paintDecls(to)}\n  }\n}`
    );
    animations.push(
      `${paintName} ${duration.toFixed(3)}s ${easingToCss(ease)} ${start.toFixed(3)}s both`
    );
  }

  return {
    rules,
    wrapperAnimation: animations.join(", "),
    counterAnimation: `${counterName} ${timing}`,
    counterName,
    geometryName: travelName
  };
};

/**
 * The window's corner as per-axis percentages, so a px radius renders
 * CIRCULAR at both ends of a non-uniformly scaled window. A percentage
 * resolves against the wrapper's local (destination) box and is then carried
 * by the scale: at the start `f/originW % of destW × sx0` is exactly `f`
 * again on both axes, whatever the aspect change.
 */
export const windowCorner = (
  fromPx: number,
  toPx: number,
  origin: MorphRect,
  destination: MorphRect
): { from: string; to: string } | null => {
  if (origin.width <= 0 || origin.height <= 0) return null;
  if (destination.width <= 0 || destination.height <= 0) return null;
  const pct = (value: number, span: number) => `${round((value / span) * 100)}%`;
  return {
    from: `${pct(fromPx, origin.width)} / ${pct(fromPx, origin.height)}`,
    to: `${pct(toPx, destination.width)} / ${pct(toPx, destination.height)}`
  };
};
