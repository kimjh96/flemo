import { easingToCss, targetToDecls } from "@transition/compileTransitionStyles";

import type { AnimationOptions, TransitionTarget } from "@transition/cssTypes";

import { composePosesToCss, IDENTITY_POSE, type MorphPose } from "@morph/morphPose";

import type { MorphClipInset } from "@morph/morphClip";

import type { MorphRect } from "@morph/morphGeometry";

const px = (value: number) => `${Math.round(value * 100) / 100}px`;

const insetCss = (inset: MorphClipInset): string =>
  `inset(${inset.top.toFixed(2)}% ${inset.right.toFixed(2)}% ${inset.bottom.toFixed(2)}% ${inset.left.toFixed(2)}%)`;

const boxBlock = (rect: MorphRect) =>
  `    left: ${px(rect.x)};\n    top: ${px(rect.y)};\n    width: ${px(rect.width)};\n    height: ${px(rect.height)};`;

const declsToBlock = (decls: { property: string; value: string }[]): string =>
  decls.map((decl) => `    ${decl.property}: ${decl.value};`).join("\n");

/** The non-transform half of an authored target — everything the geometry keyframe must not carry. */
export const contentDecls = (target: TransitionTarget | undefined | null) =>
  targetToDecls(target ?? {}).filter((decl) => decl.property !== "transform");

export interface MorphTravel {
  /** Where the element starts, relative to where it belongs. */
  from: MorphPose;
  /**
   * Where it ends. The identity for anything that belongs at its own layout —
   * which is everything except a GHOST, whose own box is the departure's and
   * which therefore has to travel TO the arrival's instead.
   */
  to?: MorphPose;
  /** An author's transform flourish, layered on top of the travel. */
  authoredFrom: MorphPose;
  authoredTo: MorphPose;
  duration: number;
  /** Seconds from the release, platform head included. */
  start: number;
  ease: AnimationOptions["ease"];
}

export interface MorphKeyframeSet {
  /** `@keyframes` blocks to insert, in order. */
  rules: string[];
  /** The `animation` shorthand to put on the element. */
  animation: string;
  /**
   * The animation whose end LANDS the flight — the geometry one where there is
   * one, the corner where the corner is all that changes.
   */
  geometryName: string;
}

/**
 * The keyframes and the `animation` shorthand for one side of a morph.
 *
 * Three animations, never one: the geometry keyframe carries `transform` and
 * NOTHING else, because a keyframe listing a property the compositor cannot
 * animate drops that whole animation to the main thread — and the travel is the
 * one that must never leave it. The cross-fade and the corner ride alongside on
 * their own clocks, which is also what lets them have their own windows: the
 * fade has to be over while the two sides are still on top of each other, the
 * corner has to track the scale for the whole flight.
 *
 * Two endpoints and the authored easing, because the element is staged in the
 * FLIGHT LAYER: it is not inside a screen any more, so there is no screen
 * motion left to compose with and nothing to sample.
 */
export const buildMorphKeyframes = (input: {
  id: string;
  travel: MorphTravel;
  /**
   * The element's LAYOUT BOX at each end, when it is the thing being animated.
   *
   * A box, not a scale. `transform: scale` stretches everything inside — text
   * becomes a blown-up bitmap and the contents cannot find their own places —
   * whereas animating the box lets the subtree lay itself out at every size on
   * the way, which is what "it grows" is supposed to mean. It costs layout per
   * frame on one subtree, which is the honest price of the thing actually
   * being laid out.
   */
  box?: { from: MorphRect; to: MorphRect } | null;
  /** Type morphs by growing, not by being scaled: px at each end. */
  fontSize?: { from: number; to: number } | null;
  /** Type's other two dimensions, so it re-typesets rather than merely re-sizing. */
  fontWeight?: { from: number; to: number } | null;
  letterSpacing?: { from: number; to: number } | null;
  wordSpacing?: { from: number; to: number } | null;
  lineHeight?: { from: number; to: number } | null;
  /** A nested element changes SHAPE by interpolating its ratio, not by snapping to it. */
  aspectRatio?: { from: string; to: string } | null;
  /** The spacing the two ends hold their contents at, and stand apart by. */
  padding?: { from: string; to: string } | null;
  margin?: { from: string; to: string } | null;
  /**
   * A nested element's OWN box, width and height only, for the one geometry
   * the container cannot carry for it. Riding assumes the container's width
   * interpolation sizes the child, and it does when the container GROWS in
   * width; a container that starts at full width (a list row becoming a page)
   * lays the arrival out at destination width from the first frame, and a
   * thumbnail inside it lands full-size instantly instead of growing. Measured
   * on the playground's list: a 48px thumb rendered as a full-width strip on
   * frame one. From-size to staged-size, exact at both ends.
   */
  size?: { from: { width: number; height: number }; to: { width: number; height: number } } | null;
  /**
   * What the scrollport was hiding at each end, as inset percentages — so a
   * cell clipped at the list's edge slides out from under the chrome covering
   * it instead of materialising whole over it (see morphClip). Percentages,
   * because the box is itself animating and the visible FRACTION is the thing
   * to preserve.
   */
  clip?: { from: MorphClipInset; to: MorphClipInset } | null;
  fade: {
    from: TransitionTarget | null;
    to: TransitionTarget | null;
    duration: number;
    /** Seconds to hold the from-pose before the fade runs, on top of `travel.start`. */
    delay?: number;
  } | null;
  /**
   * Everything the two ends paint differently — corner, surface, border,
   * shadow. One animation, so the travel keyframe stays on the compositor.
   */
  paint: { property: string; from: string; to: string }[];
}): MorphKeyframeSet => {
  const {
    id,
    travel,
    fade,
    paint,
    box,
    fontSize,
    fontWeight,
    letterSpacing,
    wordSpacing,
    lineHeight,
    aspectRatio,
    padding,
    margin,
    size,
    clip
  } = input;
  const rules: string[] = [];
  const animations: string[] = [];
  const easing = easingToCss(travel.ease);
  const start = travel.start.toFixed(3);

  const geometryName = `flemo-morph-${id}-travel`;
  const fromParts: string[] = [];
  const toParts: string[] = [];
  const pushSize = (from: string, to: string) => {
    fromParts.push(from);
    toParts.push(to);
  };
  // Which animation's end LANDS the flight. Normally the geometry one, but a
  // side whose only change is its corner emits no geometry keyframe at all —
  // and a landing waiting on an animation that was never created waits for the
  // backstop instead, a quarter-second after the motion finished.
  let clockName: string | null = null;
  if (box) {
    fromParts.push(boxBlock(box.from));
    toParts.push(boxBlock(box.to));
  }
  const fromPose = composePosesToCss([travel.from, travel.authoredFrom]);
  const toPose = composePosesToCss([travel.to ?? IDENTITY_POSE, travel.authoredTo]);
  if (fromPose !== "none" || toPose !== "none") {
    fromParts.push(`    transform: ${fromPose};`);
    toParts.push(`    transform: ${toPose};`);
  }
  if (fontSize)
    pushSize(`    font-size: ${px(fontSize.from)};`, `    font-size: ${px(fontSize.to)};`);
  if (fontWeight)
    pushSize(
      `    font-weight: ${Math.round(fontWeight.from)};`,
      `    font-weight: ${Math.round(fontWeight.to)};`
    );
  if (letterSpacing)
    pushSize(
      `    letter-spacing: ${px(letterSpacing.from)};`,
      `    letter-spacing: ${px(letterSpacing.to)};`
    );
  if (wordSpacing)
    pushSize(
      `    word-spacing: ${px(wordSpacing.from)};`,
      `    word-spacing: ${px(wordSpacing.to)};`
    );
  if (lineHeight)
    pushSize(`    line-height: ${px(lineHeight.from)};`, `    line-height: ${px(lineHeight.to)};`);
  if (aspectRatio)
    pushSize(`    aspect-ratio: ${aspectRatio.from};`, `    aspect-ratio: ${aspectRatio.to};`);
  if (padding) pushSize(`    padding: ${padding.from};`, `    padding: ${padding.to};`);
  if (margin) pushSize(`    margin: ${margin.from};`, `    margin: ${margin.to};`);
  if (size) {
    pushSize(`    width: ${px(size.from.width)};`, `    width: ${px(size.to.width)};`);
    pushSize(`    height: ${px(size.from.height)};`, `    height: ${px(size.to.height)};`);
  }
  if (clip)
    pushSize(`    clip-path: ${insetCss(clip.from)};`, `    clip-path: ${insetCss(clip.to)};`);
  if (fromParts.length > 0) {
    rules.push(
      `@keyframes ${geometryName} {\n  from {\n${fromParts.join("\n")}\n  }\n  to {\n${toParts.join("\n")}\n  }\n}`
    );
    animations.push(`${geometryName} ${travel.duration.toFixed(3)}s ${easing} ${start}s both`);
    clockName = geometryName;
  }

  if (fade && fade.duration > 0) {
    const fromDecls = contentDecls(fade.from);
    const toDecls = contentDecls(fade.to);
    if (fromDecls.length > 0 || toDecls.length > 0) {
      const fadeName = `flemo-morph-${id}-fade`;
      rules.push(
        `@keyframes ${fadeName} {\n  from {\n${declsToBlock(fromDecls)}\n  }\n  to {\n${declsToBlock(toDecls)}\n  }\n}`
      );
      const fadeStart = (travel.start + (fade.delay ?? 0)).toFixed(3);
      animations.push(`${fadeName} ${fade.duration.toFixed(3)}s ${easing} ${fadeStart}s both`);
    }
  }

  if (paint.length > 0) {
    const paintName = `flemo-morph-${id}-paint`;
    const from = paint.map((channel) => `    ${channel.property}: ${channel.from};`).join("\n");
    const to = paint.map((channel) => `    ${channel.property}: ${channel.to};`).join("\n");
    rules.push(`@keyframes ${paintName} {\n  from {\n${from}\n  }\n  to {\n${to}\n  }\n}`);
    animations.push(`${paintName} ${travel.duration.toFixed(3)}s ${easing} ${start}s both`);
    // It runs the flight's full length, so it is a sound clock for a side whose
    // only change is a colour or a corner. The fade is not: it is over while
    // the two sides are still on top of each other, which is most of a flight
    // too early to land on.
    clockName ??= paintName;
  }

  return { rules, animation: animations.join(", "), geometryName: clockName ?? geometryName };
};

/**
 * The CAMERA: the transform that takes a screen from resting to "zoomed onto
 * this element", for a flight that carries its screen.
 *
 * One uniform scale and one translate, both literal — the same discipline the
 * travel keeps, and for the same reason: a compiled animation whose values come
 * from custom properties was device-bisected off the compositor on WebKit
 * (see the literal-timing note in compileTransitionStyles).
 *
 * The scale comes from WIDTH alone. The element's own box changes aspect across
 * the flight, so no single uniform scale can match both axes, and width is the
 * axis a column grid is built on: at the end of the zoom the tapped cell is
 * exactly as wide as the screen, which is what puts everything else off the
 * edges.
 *
 * The animation is emitted as LONGHANDS, never the `animation` shorthand: the
 * shorthand would also write `animation-play-state`, and that longhand belongs
 * to the compiled hold — the camera has to pause and release with its screen
 * like everything else in the flight.
 */
export const buildCameraKeyframes = (input: {
  id: string;
  /** The screen's transform-origin, in the same space as the rects. */
  origin: { x: number; y: number };
  /** The element's box on the screen being carried, and at the other end. */
  small: MorphRect;
  big: MorphRect;
  /** True when the screen is arriving (a pop): it starts zoomed and settles. */
  settling: boolean;
  duration: number;
  start: number;
  ease: AnimationOptions["ease"];
  selector: string;
}): { rules: string[]; name: string } => {
  const { id, origin, small, big, settling, duration, start, ease, selector } = input;
  const scale = small.width > 0 ? big.width / small.width : 1;
  const centre = (rect: MorphRect) => ({
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  });
  const from = centre(small);
  const to = centre(big);
  // With `transform-origin: o`, a point p maps to o + scale * (p - o) + t.
  // Solve for the t that lands the small box's centre on the big one's.
  const tx = to.x - origin.x - scale * (from.x - origin.x);
  const ty = to.y - origin.y - scale * (from.y - origin.y);
  const zoomed = `translate(${px(tx)}, ${px(ty)}) scale(${Math.round(scale * 10000) / 10000})`;
  const name = `flemo-morph-${id}-camera`;
  const rules = [
    `@keyframes ${name} {\n  from {\n    transform: ${settling ? zoomed : "none"};\n  }\n  to {\n    transform: ${settling ? "none" : zoomed};\n  }\n}`,
    `${selector} {\n  animation-name: ${name} !important;\n  animation-duration: ${duration.toFixed(3)}s !important;\n  animation-timing-function: ${easingToCss(ease)} !important;\n  animation-delay: ${start.toFixed(3)}s !important;\n  animation-fill-mode: both !important;\n}`
  ];
  return { rules, name };
};
