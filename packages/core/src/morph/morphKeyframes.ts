import { easingToCss, targetToDecls } from "@transition/compileTransitionStyles";

import type { AnimationOptions, TransitionTarget } from "@transition/cssTypes";

import {
  composePoses,
  composePosesToCss,
  IDENTITY_POSE,
  type MorphPose,
  PINNED_POSE_TRANSFORM,
  pinnedPoseDecls
} from "@morph/morphPose";

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
  /**
   * Whether the geometry keyframe is one the COMPOSITOR can run.
   *
   * True only where the travel is a transform and nothing else. A keyframe that
   * also carries a box, a type size or a clip is resolved by the MAIN THREAD,
   * once per frame it manages to produce — and anything that has to stay
   * registered with it has to be presented from there too (see the camera).
   */
  geometryAccelerated: boolean;
  /**
   * The `transform` the caller must set on the element, or null.
   *
   * Non-null only for a PINNED set, whose keyframes animate the pose's
   * coordinates rather than the transform itself, and which therefore needs the
   * transform that reads them (see PINNED_POSE_TRANSFORM).
   */
  transform: string | null;
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
  /**
   * The line-height as a STAIRCASE, holding the leading still for the flight.
   *
   * Supersedes `lineHeight` where it is given: the two cannot both author the
   * property, and the staircase is the one that keeps the glyphs from stepping
   * inside the box (see morphLine). It rides its own animation because it needs
   * its own timing — each stop HOLDS until the next, which is what a staircase
   * is, and the geometry keyframe cannot hold one channel while easing the rest.
   */
  leading?: { at: number; lineHeight: number }[] | null;
  /**
   * The ascent's staircase, carried backwards on the box so the two cancel.
   *
   * A held leading still leaves the BASELINE stepping, because it sits an
   * ascent below the inline box's top and the ascent is on the same grid. The
   * two terms are both grid-locked, so nothing done to the line-height can make
   * their sum smooth. The box under them is not grid-locked, so the flight
   * sends the box the OTHER way by the same amount and the glyphs come out
   * still: the box travels to `top + ascent` and a transform takes the ascent
   * straight back off, exactly at both ends and within half a pixel between.
   *
   * A box wobbling half a pixel is nothing to look at; a line of type doing it
   * is the tremor this exists to remove.
   */
  lift?: { at: number; ascent: number }[] | null;
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
  /**
   * Keep this set on the main thread even where its geometry is a transform the
   * compositor could have run.
   *
   * A flight is one composition, and its parts are placed relative to each
   * other. The moment one of them travels by its box — which is every flight
   * where the element GROWS rather than being scaled — the frames it can be
   * drawn on are the main thread's, and a part that keeps advancing without it
   * separates from it by however far behind that thread is. A ghost is the
   * clearest case: it is a copy of the departure whose only job is to sit on
   * the element it dissolves into, and one that leads prints the card twice.
   *
   * So the flight decides once, and every part it emits abides by it. Ignored
   * where the geometry is already layout-bound, which needs no help.
   */
  pinned?: boolean;
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
    clip,
    leading,
    lift,
    pinned = false
  } = input;
  const rules: string[] = [];
  const animations: string[] = [];
  const easing = easingToCss(travel.ease);
  const start = travel.start.toFixed(3);
  const authored =
    composePosesToCss([travel.from, travel.authoredFrom]) !== "none" ||
    composePosesToCss([travel.to ?? IDENTITY_POSE, travel.authoredTo]) !== "none";

  const geometryName = `flemo-morph-${id}-travel`;
  const fromParts: string[] = [];
  const toParts: string[] = [];
  // Anything but the transform takes the whole keyframe off the compositor, so
  // a set carrying any of it is the main thread's already and needs no pinning.
  const staircase = leading && leading.length > 1 ? leading : null;
  // The two travel together or not at all: a box sent to `top + ascent` with
  // nothing to take the ascent back off is a line of type an ascent too low.
  // And the taking-off is a transform, so a set that already writes one of its
  // own has no room for it.
  const carried =
    leading && leading.length > 1 && lift && lift.length > 1 && !authored ? lift : null;
  const layoutBound = Boolean(
    box ||
    fontSize ||
    fontWeight ||
    letterSpacing ||
    wordSpacing ||
    lineHeight ||
    aspectRatio ||
    padding ||
    margin ||
    size ||
    clip
  );
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
    const raise = carried
      ? { from: carried[0]!.ascent, to: carried[carried.length - 1]!.ascent }
      : { from: 0, to: 0 };
    fromParts.push(boxBlock({ ...box.from, y: box.from.y + raise.from }));
    toParts.push(boxBlock({ ...box.to, y: box.to.y + raise.to }));
  }
  const fromPoses = composePoses([travel.from, travel.authoredFrom]);
  const toPoses = composePoses([travel.to ?? IDENTITY_POSE, travel.authoredTo]);
  // A pinned pose is five numbers, which says ONE transform. Where an end
  // composes two — a measured travel with an author's flourish stacked on it —
  // concatenation is a matrix product that five numbers cannot always express,
  // so that set stays literal rather than being approximated. It is then still
  // accelerated, and this is recorded rather than hidden: a flight that reaches
  // it has a part that can lead the rest.
  const pinnable = pinned && !layoutBound && fromPoses.length <= 1 && toPoses.length <= 1;
  const fromPose = composePosesToCss([travel.from, travel.authoredFrom]);
  const toPose = composePosesToCss([travel.to ?? IDENTITY_POSE, travel.authoredTo]);
  let transform: string | null = null;
  if (fromPose !== "none" || toPose !== "none") {
    if (pinnable) {
      transform = PINNED_POSE_TRANSFORM;
      fromParts.push(pinnedPoseDecls(fromPoses[0] ?? IDENTITY_POSE));
      toParts.push(pinnedPoseDecls(toPoses[0] ?? IDENTITY_POSE));
    } else {
      fromParts.push(`    transform: ${fromPose};`);
      toParts.push(`    transform: ${toPose};`);
    }
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
  if (lineHeight && !staircase)
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

  if (staircase) {
    const leadName = `flemo-morph-${id}-lead`;
    // `steps(1, end)` on every stop is what makes this a staircase rather than
    // a ramp: each value is held for its whole interval and changes at the
    // instant the face height it matches does.
    const blocks = staircase
      .map(
        (stop) =>
          `  ${stop.at.toFixed(4)}% {\n    line-height: ${px(stop.lineHeight)};\n    animation-timing-function: steps(1, end);\n  }`
      )
      .join("\n");
    rules.push(`@keyframes ${leadName} {\n${blocks}\n}`);
    // Linear, because the stops already carry the flight's easing in WHERE they
    // sit; easing between them again would move them.
    animations.push(`${leadName} ${travel.duration.toFixed(3)}s linear ${start}s both`);
  }

  if (carried) {
    const liftName = `flemo-morph-${id}-lift`;
    const blocks = carried
      .map(
        (stop) =>
          `  ${stop.at.toFixed(4)}% {\n    transform: translateY(${px(-stop.ascent)});\n    animation-timing-function: steps(1, end);\n  }`
      )
      .join("\n");
    rules.push(`@keyframes ${liftName} {\n${blocks}\n}`);
    animations.push(`${liftName} ${travel.duration.toFixed(3)}s linear ${start}s both`);
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

  return {
    rules,
    animation: animations.join(", "),
    geometryName: clockName ?? geometryName,
    // A pinned set is not on the compositor either, and a caller reading this to
    // decide what else has to wait must be told the truth about it.
    geometryAccelerated: !layoutBound && transform === null,
    transform
  };
};

/**
 * The CAMERA: the transform that takes a screen from resting to "zoomed onto
 * this element", for a flight that carries its screen.
 *
 * One uniform scale and one translate.
 *
 * THE CAMERA IS NOT AN ANIMATION OF ITS OWN. It is defined as exactly the zoom
 * that carries the element from one end of the flight to the other, and the two
 * are emitted on one clock: same duration, same delay, same easing, released
 * together. Measured, they agree to a thousandth of a frame at every sample.
 *
 * They still do not agree ON GLASS, because they are not PRESENTED by the same
 * thread. A transform is one of the few things a compositor can run by itself,
 * so the camera advances every vsync whatever the page is doing; the element
 * travels by its box, which no compositor can interpolate, so it advances only
 * on frames the main thread manages to produce. Isolated on both engines: with
 * the main thread blocked mid-flight, a transform twin of a box travel ran 146px
 * (Blink) and 167px (WebKit) ahead of it before the box moved at all. That gap
 * is the whole defect — a card trailing the grid it is supposed to be opening
 * out of, reported from iOS Safari as the camera being a beat ahead of the card.
 *
 * So where the element it carries is main-thread bound, the camera is too: the
 * transform is composed from REGISTERED custom properties and the keyframes
 * animate those, which no compositor can run because the substitution is style
 * resolution's work. It then advances on exactly the frames the element does,
 * and the pair is rigid again at whatever rate the device can hold.
 *
 * That is the only lever that works. `calc(var())` in the timing — the one this
 * codebase already knew took a fade off WebKit's compositor — leaves a literal
 * transform accelerated on both engines, as do constant `left`, `background-color`
 * and `clip-path` channels alongside it; all four were measured to run away from
 * the main thread exactly as the plain transform did. It costs nothing: the
 * screen keeps its layer, so the per-frame work is a style resolution and a
 * transform update, and frame times were indistinguishable from the literal form
 * at 1x, 6x and 12x CPU throttle.
 *
 * Where the element's own travel IS a transform, the camera stays literal and
 * accelerated: there is then nothing main-thread bound for it to wait for.
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
  /**
   * Emit the literal transform the compositor can run.
   *
   * True only where the element this camera carries is itself on the
   * compositor; false pins the camera to the main thread's cadence, which is
   * where a box travel lives (see above).
   */
  accelerated: boolean;
}): { rules: string[]; name: string } => {
  const { id, origin, small, big, settling, duration, start, ease, selector, accelerated } = input;
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
  // The camera is a pose like any other: a translate and one uniform scale. Said
  // that way it pins through exactly the same registered properties every other
  // participant in the flight does.
  const uniform = Math.round(scale * 10000) / 10000;
  const zoomed: MorphPose = { x: tx, y: ty, scaleX: uniform, scaleY: uniform, rotate: 0 };
  const stop = (atRest: boolean) => {
    const pose = atRest ? IDENTITY_POSE : zoomed;
    if (!accelerated) return pinnedPoseDecls(pose);
    return `    transform: ${atRest ? "none" : `translate(${px(pose.x)}, ${px(pose.y)}) scale(${uniform})`};`;
  };
  const name = `flemo-morph-${id}-camera`;
  const rules = [
    `@keyframes ${name} {\n  from {\n${stop(!settling)}\n  }\n  to {\n${stop(settling)}\n  }\n}`,
    `${selector} {\n${accelerated ? "" : `  transform: ${PINNED_POSE_TRANSFORM} !important;\n`}  animation-name: ${name} !important;\n  animation-duration: ${duration.toFixed(3)}s !important;\n  animation-timing-function: ${easingToCss(ease)} !important;\n  animation-delay: ${start.toFixed(3)}s !important;\n  animation-fill-mode: both !important;\n}`
  ];
  return { rules, name };
};
