import { easingToCss, targetToDecls } from "@transition/compileTransitionStyles";

import type { AnimationOptions, TransitionTarget } from "@transition/cssTypes";

import {
  composePoses,
  composePosesToCss,
  IDENTITY_POSE,
  type MorphPose,
  PINNED_POSE_TRANSFORM,
  pinnedPoseDecls,
  pinnedLiftDecl,
  PINNED_BOX,
  PINNED_BOX_HEIGHT,
  PINNED_TRACK,
  onRuler,
  pinnedBoxDeclsOnRuler,
  pinnedTrackDecl,
  pinnedTrackFixDecl,
  PINNED_TRAVEL,
  pinnedTravelDecls
} from "@morph/morphPose";

import type { MorphClipInset } from "@morph/morphClip";

import type { MorphRect } from "@morph/morphGeometry";

const px = (value: number) => `${Math.round(value * 100) / 100}px`;

// A TYPE LENGTH ROUNDED IS A LINE ON THE WRONG PIXEL.
//
// Two decimals is enough for a box, whose edge the eye reads at the pixel it
// lands on. It is not enough for a face: a leading given as a FACTOR resolves
// against the size and is then rounded to a whole pixel, so a size that is a
// hair off puts the leading on the other side of a half-pixel and the whole
// line moves a pixel. Device-read on a consumer's phone, at a landing: the same
// element, the same family, a size reported as 11.00 at both ends, and a
// leading of 17px on the flight's last frame against 16px at rest, with nothing
// inline and no parent changing. 11 x 1.5 is 16.5, and the flight was standing
// on the wrong side of it.
//
// Printed at the precision the value actually has, both ends resolve the same.
const typePx = (value: number) => `${Number.parseFloat(value.toFixed(6)).toString()}px`;

const insetCss = (inset: MorphClipInset): string =>
  `inset(${inset.top.toFixed(2)}% ${inset.right.toFixed(2)}% ${inset.bottom.toFixed(2)}% ${inset.left.toFixed(2)}%)`;

// THE BOX TRAVELS BY SIZE AND MOVES BY TRANSLATE.
//
// A size has to be laid out — that is the whole point of a type morph, and it
// is why the geometry keyframe cannot be the compositor's. A POSITION does not,
// and where it comes from decides how the glyphs on it are painted. Measured on
// desktop Chrome at 2x, moving the same line of type by the same amount:
//
//   asked      by `top`   by `translate`   by `translate`, promoted
//   0.125px      0.000        0.000                0.352
//   0.250px      0.000        0.500                0.451
//   0.500px      1.000        0.500                0.500
//
// Blink paints text from a LAYOUT position at whole CSS pixels. So a line that
// travels by `top` does not glide, it steps a full pixel at a time — and the
// ease crawls at the landing, which is where the steps are slow enough to read
// as a tremor. `getBoundingClientRect` reports the smooth value throughout,
// which is why every layout measurement of this said it was fine.
//
// WebKit already paints a layout position on the device grid, so it sees half
// of the step and none of this changes it. Promotion alone does not help
// either: it is the layout ORIGIN of the position that is rounded, not the
// layer.
//
// `translate` rather than `transform`, so an author's pose keeps `transform`
// to itself and the two compose instead of overwriting one another.
// `sized` writes the box's own size through the channel instead of the
// property, which is what keeps WebKit from dropping it (see morphPose).
const boxBlock = (rect: MorphRect, moved: boolean, sized: boolean) =>
  `${moved ? "" : `    left: ${px(rect.x)};\n    top: ${px(rect.y)};\n`}${
    sized
      ? pinnedBoxDeclsOnRuler(rect.width, rect.height)
      : `    width: ${px(rect.width)};\n    height: ${px(rect.height)};`
  }`;

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
  /**
   * The platform's flat lead-in, ALREADY COUNTED IN `start`.
   *
   * A HEAD IS NOT A DELAY. Waiting it out as a delay leaves the animation
   * uncommitted until the instant it must move, so a first frame that arrives
   * late arrives PARTWAY THROUGH — the curve is entered wherever the clock
   * says and everything before that is never drawn. Given here, the same
   * seconds are baked into the keyframes as a flat stop instead: the animation
   * is running and still, a late first frame lands inside the lead-in, and the
   * curve plays from 0. The screens have ridden it this way since the head was
   * invented; this is the flight riding it the same way.
   *
   * Painted frames off a consumer's phone, 60fps: the first frame the box was
   * drawn on was already 67% of the way through its travel. The computed value
   * ramped correctly throughout, which is why every main-thread probe called it
   * healthy.
   */
  head?: number;
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
   * The `translate` the caller must set on the element, or null.
   *
   * Non-null where the travel is driven through registered properties, which
   * is what keeps its position on the same thread as its size.
   */
  translate: string | null;
  /**
   * The `width` and `height` the caller must set on the element, or null.
   *
   * Non-null where the box's size is driven through registered properties,
   * which is what keeps an engine from dropping it (see morphPose).
   */
  size: { width: string; height: string } | null;
  /**
   * The width the box is HELD at for the whole flight, or null.
   *
   * The viewport x of a far edge both ends agree on, when there is one.
   *
   * The element is placed FROM it — `left: calc(<edge>px - var(--flemo-box-w))`
   * — so the edge is derived from the very channel the width animates on and
   * the two round together. Reached as position + size instead, the engine
   * rounds each to its own layout unit and their sum oscillates: measured on a
   * consumer's pill, 366.000 with the anchor against 365.985 ± 0.015 without,
   * reversing six times in twenty-three frames, and every right-aligned thing
   * inside it followed.
   */
  heldEdge: number | null;
  /**
   * The `transform` the caller must set on the element, or null.
   *
   * Non-null only for a PINNED set, whose keyframes animate the pose's
   * coordinates rather than the transform itself, and which therefore needs the
   * transform that reads them (see PINNED_POSE_TRANSFORM).
   */
  transform: string | null;
  /**
   * The `letter-spacing` the caller must set on the element, or null.
   *
   * Non-null where the tracking carries a correction, which is written as a sum
   * of the author's own and the correction's, each on its own clock.
   */
  letterSpacing: string | null;
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
  /**
   * Whether the two ends lay their CONTENTS out in the same places, measured.
   *
   * A box animates for real wherever this is false, because something inside
   * has a different place at the two ends and only a layout per frame can take
   * it there. Where it is true the subtree is the same picture at every size on
   * the way, so the box is laid out ONCE and the near edge is cut back with a
   * clip instead (see the reveal below). It is measured rather than inferred
   * from the box's shape: a shape says nothing about a consumer's subtree.
   */
  contentsHold?: boolean;
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
  /**
   * What the baseline owes at the START, in px, because the staircase holds the
   * ARRIVAL's leading from the first frame (see attachMorph).
   *
   * Paid on the same channel as the ascent's cancellation and with the same
   * shape: the whole amount at the departure, nothing at the landing, so what
   * the flight travels is unchanged and only its first frame moves.
   */
  leadStart?: number | null;
  /**
   * The correction that keeps a growing run of glyphs from drifting apart.
   *
   * A run's width against its size is one curve, and where it leaves the
   * straight line between its ends every glyph carries the error that piled up
   * before it. Spread the negative of that over the gaps and it cancels (see
   * morphLine). It rides `letter-spacing` beside the author's own tracking, on
   * its own clock, and is RAMPED rather than held because what it cancels is a
   * curve rather than a staircase.
   */
  track?: { at: number; fix: number }[] | null;
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
  /**
   * The corner the box wears, so a clip that reveals it cuts a rounded shape
   * rather than a square one (see the reveal below).
   */
  radius?: string | null;
  fade: {
    from: TransitionTarget | null;
    to: TransitionTarget | null;
    duration: number;
    /** Seconds to hold the from-pose before the fade runs, on top of `travel.start`. */
    delay?: number;
    /**
     * The curve, where the flight's own is not the right one.
     *
     * A HAND-OVER IS A STEP, NOT A RAMP. Two opacity ramps crossing never
     * compose back to what they replaced: at the midpoint of a 1-to-0 against a
     * 0-to-1, alpha compositing leaves 1 - (1 - 0.5) * 0.5 = 0.75 of the pair,
     * and the engines do not even sample the two on the same phase. Device-read
     * on a consumer's tab switch: the copy at 0.48 against the arrival at 0.33,
     * two frames of a washed-out box mid-travel — read as a blink.
     *
     * A step at the same instant on both sides has no such midpoint. Both are
     * pure functions of one timeline, so every frame that renders at all
     * renders exactly one of them, and a missed frame cannot land between.
     */
    easing?: string;
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
  /**
   * Drive the travel's own position through registered properties.
   *
   * False only where they could not be registered, and there the position goes
   * back to `left` and `top`: a literal `translate` would be run by WebKit's
   * compositor while the size it belongs to waits for the main thread.
   */
  travelPinned?: boolean;
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
    contentsHold = false,
    radius,
    leading,
    leadStart,
    lift,
    track,
    pinned = false,
    travelPinned = false
  } = input;
  const rules: string[] = [];
  const animations: string[] = [];
  const easing = easingToCss(travel.ease);
  // The head is spent inside the animation, not in front of it: the same
  // seconds, the same first moment of motion, the same landing — the delay
  // gives them back and the keyframes hold them.
  const head = Math.max(0, Math.min(travel.head ?? 0, travel.start));
  const span = travel.duration + head;
  const headPct = head > 0 ? (head / span) * 100 : 0;
  const clock = `${span.toFixed(3)}s`;
  const start = (travel.start - head).toFixed(3);
  /** A percentage of the travel, restated as a percentage of head-plus-travel. */
  const at = (pct: number): number =>
    head > 0 ? headPct + (pct / 100) * (travel.duration / span) * 100 : pct;
  /** Two-stop keyframes, with the flat lead-in in front where there is one. */
  // A FLIGHT HAS TO ARRIVE BEFORE IT LANDS.
  //
  // The last frame a flight is painted on is not its 100%: the animation ends
  // between that frame and the next, so the last thing on glass is the curve a
  // fraction short of its destination. For a box that is a sub-pixel nobody can
  // see. For TYPE it is a whole pixel, because a face's ascent is quantised and
  // a size a thousandth short of its resting value snaps to the grid line
  // above: device-read at a landing, the last painted frame carried a size of
  // 11.0006px against a resting 11.0000, and the words sat 1.03px high until
  // the flight let go.
  //
  // So the destination is reached ONE FRAME EARLY and held there. The last
  // frame on glass is then the resting state itself and the landing changes
  // nothing. What is given up is the last sixtieth of a second of an ease that
  // is already flat there.
  const arrived = span > 0 ? Math.max(0, 100 - (100 * (1 / 60)) / span) : 100;
  const held = (name: string, fromBlock: string, toBlock: string): string => {
    const landing =
      arrived >= 99.999
        ? `  100% {\n${toBlock}\n  }`
        : `  ${arrived.toFixed(3)}%, 100% {\n${toBlock}\n  }`;
    return head > 0
      ? `@keyframes ${name} {\n  0%, ${headPct.toFixed(3)}% {\n${fromBlock}\n  }\n${landing}\n}`
      : `@keyframes ${name} {\n  0% {\n${fromBlock}\n  }\n${landing}\n}`;
  };
  const geometryName = `flemo-morph-${id}-travel`;
  const fromParts: string[] = [];
  const toParts: string[] = [];
  // Anything but the transform takes the whole keyframe off the compositor, so
  // a set carrying any of it is the main thread's already and needs no pinning.
  const staircase = leading && leading.length > 1 ? leading : null;
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
  const fromPoses = composePoses([travel.from, travel.authoredFrom]);
  const toPoses = composePoses([travel.to ?? IDENTITY_POSE, travel.authoredTo]);

  // ONE CHANNEL CARRIES THE POSITION, WHATEVER THE POSITION CAME FROM.
  //
  // A box travel and a pose's translate are both translations on the same
  // clock, so they add up, and adding them up is what lets the ascent's
  // cancellation ride along on the same property (see morphPose). It is why
  // this works for a pair that FLIES and a pair that RIDES its container alike:
  // the first has a box and no pose, the second a pose and no box, and neither
  // is a special case here.
  //
  // Only where a single pose stands at each end. Two of them is a matrix
  // product — `transform: A B` maps a point through B and then A — and pulling
  // the second one's translate out to the front would not be the same motion.
  const solo = fromPoses.length <= 1 && toPoses.length <= 1;
  const moving = travelPinned && solo;
  const lifting = moving && staircase && lift && lift.length > 1 ? lift : null;
  // The tracking correction needs the property to itself, which it gets by
  // carrying the author's own tracking alongside it on the same `calc`.
  const tracking = travelPinned && track && track.length > 1 ? track : null;
  // The box's size goes through the channel wherever the keyframe is already
  // animating custom properties, which is the case WebKit drops it in.
  const sized = Boolean(box) && (moving || Boolean(tracking));
  // AN EDGE THAT DOES NOT MOVE MUST NOT BE A SUM.
  //
  // A box that travels carries its position on one channel and its size on
  // another, and the engine rounds each to its own layout unit. The far edge
  // is their SUM, so it oscillates by that unit even when both ends agree on
  // where it is: measured on a consumer's pill whose two ends share a right
  // edge at 369px, the edge ran 369, 368.987, 368.999, 368.996, 369 frame
  // after frame, and every right-aligned thing inside it followed. Both
  // engines, the same 1/64px.
  //
  // Where the two ends DO agree on an edge, the travel does not have to reach
  // it through a sum: the element is anchored on that edge and only its size
  // is animated, so the edge is one value and cannot disagree with itself.
  const holds = (from: number, to: number) => Math.abs(from - to) < 0.05;
  const rightHeld = Boolean(
    box &&
    solo &&
    !fromPoses[0] &&
    !toPoses[0] &&
    holds(box.from.x + box.from.width, box.to.x + box.to.width) &&
    !holds(box.from.x, box.to.x)
  );
  // A BOX WHOSE SIZE ANIMATES IS RE-RASTERED, AND THE RASTER SHIMMERS.
  //
  // Animating the size is what makes a morph a growth rather than a stretch:
  // the subtree lays itself out at every size on the way, which is the only way
  // text can re-wrap into its new shape. It is also a full layout and a fresh
  // raster of that subtree on every frame, and WebKit re-snaps the backing to
  // the device grid each time, so the contents are carried a device pixel back
  // and forth for the whole flight whether they needed to move or not.
  //
  // TRIED AND FALSIFIED, in this order, all four on a consumer's phone: letting
  // the size animate for real; stepping it so it changes five times instead of
  // every frame; stepping it onto the DEVICE grid so every value is one the
  // display can draw; and approaching the engine's ruler from one side so the
  // backing cannot cut to the pixel before. The tremble followed the NUMBER of
  // size changes every time and no arithmetic on the value removed it. Freezing
  // the size stopped it dead on every run.
  //
  // Which is the answer, because the per-frame layout was buying NOTHING here.
  // Measured across a flight, every descendant of the pill held one position
  // for all of its frames and only the box's own near edge moved: the contents
  // are right-aligned, the box grows leftward, and what grows is empty space.
  //
  // So the flight asks, rather than guesses: `contentsHold` lays the arrival
  // out at both of its sizes and compares where every child and every line of
  // text falls from the corner the flight anchors on (see morphContents). Where
  // they agree, the
  // box is laid out ONCE at the size that contains both ends and the near edge
  // is cut back with a clip — the same picture, drawn once. Where they disagree
  // the size animates for real, because something inside genuinely has to be
  // somewhere else, and that layout is the honest price of it.
  const holdsAt = (from: number, to: number) => Math.abs(from - to) < 0.05;
  const reveal =
    box &&
    contentsHold &&
    moving &&
    !clip &&
    !(holdsAt(box.from.width, box.to.width) && holdsAt(box.from.height, box.to.height))
      ? (() => {
          // The box is laid out at the size that CONTAINS both ends, and each
          // end is that box with the growth cut back off it. The cut is on the
          // edges opposite the corner the flight is anchored on, because that
          // is the corner the box grows away from: a right-held box grows
          // leftward, everything else grows right and down from where it sits.
          const width = Math.max(box.from.width, box.to.width);
          const height = Math.max(box.from.height, box.to.height);
          const cut = (rect: MorphRect) => {
            const across = (((width - rect.width) / width) * 100).toFixed(3);
            const down = (((height - rect.height) / height) * 100).toFixed(3);
            const right = rightHeld ? "0.000" : across;
            const left = rightHeld ? across : "0.000";
            return `0% ${right}% ${down}% ${left}%`;
          };
          return { width, height, from: cut(box.from), to: cut(box.to) };
        })()
      : null;

  if (moving) {
    // The element RESTS at its destination and is carried back to where it
    // started, so the position it is laid out at never moves.
    const at = (
      side: "from" | "to",
      poses: MorphPose[],
      ascent: number
    ): { x: number; y: number } => {
      const pose = poses[0];
      const rect = box ? (side === "from" ? box.from : box.to) : null;
      return {
        x: rightHeld ? (pose ? pose.x : 0) : (rect ? rect.x - box!.to.x : 0) + (pose ? pose.x : 0),
        y: (rect ? rect.y - box!.to.y : 0) + (pose ? pose.y : 0) + ascent
      };
    };
    // The smooth half of the cancellation: the position goes UP by the ascent
    // at both ends, and the staircase below takes it straight back off.
    const rise = lifting
      ? { from: lifting[0]!.ascent, to: lifting[lifting.length - 1]!.ascent }
      : { from: 0, to: 0 };
    // And the half-leading the staircase does not render at the departure,
    // owed only at the start because the last stop is the arrival's own line.
    if (staircase && leadStart) rise.from += leadStart;
    const start = at("from", fromPoses, rise.from);
    const end = at("to", toPoses, rise.to);
    fromParts.push(pinnedTravelDecls(start.x, start.y));
    toParts.push(pinnedTravelDecls(end.x, end.y));
  }
  if (box) {
    // A revealed box is laid out ONCE, at the size that contains both ends, and
    // the clip below is what changes. Both ends therefore state the same size.
    const held = reveal ? { ...box.to, width: reveal.width, height: reveal.height } : null;
    fromParts.push(boxBlock(held ?? box.from, moving, sized));
    toParts.push(boxBlock(held ?? box.to, moving, sized));
  }
  // A pinned pose is five numbers, which says ONE transform. Where an end
  // composes two — a measured travel with an author's flourish stacked on it —
  // concatenation is a matrix product that five numbers cannot always express,
  // so that set stays literal rather than being approximated. It is then still
  // accelerated, and this is recorded rather than hidden: a flight that reaches
  // it has a part that can lead the rest.
  const pinnable = pinned && !layoutBound && solo;
  // Whatever the move channel took, the transform does not repeat. `translate`
  // is applied before `transform`, so a translation pulled out to the front
  // composes to the same matrix it was part of.
  const rest = (poses: MorphPose[]): MorphPose[] =>
    moving ? poses.map((pose) => ({ ...pose, x: 0, y: 0 })) : poses;
  const fromPose = composePosesToCss(rest(fromPoses));
  const toPose = composePosesToCss(rest(toPoses));
  let transform: string | null = null;
  if (fromPose !== "none" || toPose !== "none") {
    if (pinnable) {
      transform = PINNED_POSE_TRANSFORM;
      fromParts.push(pinnedPoseDecls(rest(fromPoses)[0] ?? IDENTITY_POSE));
      toParts.push(pinnedPoseDecls(rest(toPoses)[0] ?? IDENTITY_POSE));
    } else {
      fromParts.push(`    transform: ${fromPose};`);
      toParts.push(`    transform: ${toPose};`);
    }
  }
  if (fontSize)
    pushSize(`    font-size: ${typePx(fontSize.from)};`, `    font-size: ${typePx(fontSize.to)};`);
  if (fontWeight)
    pushSize(
      `    font-weight: ${Math.round(fontWeight.from)};`,
      `    font-weight: ${Math.round(fontWeight.to)};`
    );
  if (tracking) {
    pushSize(
      pinnedTrackDecl(letterSpacing ? letterSpacing.from : 0),
      pinnedTrackDecl(letterSpacing ? letterSpacing.to : 0)
    );
  } else if (letterSpacing) {
    pushSize(
      `    letter-spacing: ${px(letterSpacing.from)};`,
      `    letter-spacing: ${px(letterSpacing.to)};`
    );
  }
  if (wordSpacing)
    pushSize(
      `    word-spacing: ${px(wordSpacing.from)};`,
      `    word-spacing: ${px(wordSpacing.to)};`
    );
  if (lineHeight && !staircase)
    pushSize(
      `    line-height: ${typePx(lineHeight.from)};`,
      `    line-height: ${typePx(lineHeight.to)};`
    );
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
  else if (reveal) {
    // ROUND, or the reveal is a square cut across a rounded box: the left
    // corner disappears for the whole flight and what grows reads as a plain
    // rectangle sitting over the pill rather than the pill itself.
    const round = radius && radius !== "0px" ? ` round ${radius}` : "";
    pushSize(
      `    clip-path: inset(${reveal.from}${round});`,
      `    clip-path: inset(${reveal.to}${round});`
    );
  }
  if (fromParts.length > 0) {
    rules.push(held(geometryName, fromParts.join("\n"), toParts.join("\n")));
    animations.push(`${geometryName} ${clock} ${easing} ${start}s both`);
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
      // Against `travel.start`, which the head does not move: a cut lands on
      // the frame the box starts moving whether or not a lead-in precedes it.
      const fadeStart = (travel.start + (fade.delay ?? 0)).toFixed(3);
      animations.push(
        `${fadeName} ${fade.duration.toFixed(3)}s ${fade.easing ?? easing} ${fadeStart}s both`
      );
    }
  }

  if (staircase) {
    const leadName = `flemo-morph-${id}-lead`;
    // A STOP AT THE VERY END IS A STEP THE LANDING TAKES, NOT THE FLIGHT.
    //
    // Each stop is held by `steps(1, end)` until the next one, so a final stop
    // sitting at 100% is never painted while the flight runs: the value before
    // it stands on glass right up to the last frame and the arrival's own value
    // appears for the first time at the instant the animation lets go. The
    // staircase exists to stop the leading stepping, and that placement moves
    // one of its steps to the worst moment there is, when everything else has
    // already stopped. Read off a consumer's phone, keyframe by keyframe: a
    // meta line's stops ran 20px, 19px, 17px, and then 16px AT 100%, and the
    // words dropped 1.03px on the landing frame.
    //
    // So the last stop is brought forward by a frame. The arrival's leading is
    // then on glass before the flight ends, and the landing changes nothing.
    const lastFrame = span > 0 ? Math.max(0, 100 - (100 * (1 / 60)) / span) : 100;
    const stops = staircase.map((stop, index) =>
      index === staircase.length - 1
        ? { ...stop, at: Math.min(at(stop.at), lastFrame) }
        : { ...stop, at: at(stop.at) }
    );
    // `steps(1, end)` on every stop is what makes this a staircase rather than
    // a ramp: each value is held for its whole interval and changes at the
    // instant the face height it matches does.
    const blocks = stops
      .map(
        (stop) =>
          `  ${stop.at.toFixed(4)}% {\n    line-height: ${typePx(stop.lineHeight)};\n    animation-timing-function: steps(1, end);\n  }`
      )
      .join("\n");
    rules.push(`@keyframes ${leadName} {\n${blocks}\n}`);
    // Linear, because the stops already carry the flight's easing in WHERE they
    // sit; easing between them again would move them.
    animations.push(`${leadName} ${clock} linear ${start}s both`);
  }

  if (lifting) {
    const liftName = `flemo-morph-${id}-lift`;
    // `steps(1, end)` on every stop is what makes this a staircase rather than
    // a ramp: each value is held for its whole interval and changes at the
    // instant the face height it matches does.
    // Brought forward by a frame at the end, for the reason the leading's is:
    // a stop at 100% is a step the LANDING takes. This one carries the ascent's
    // cancellation, so the step it hides there is the whole baseline: measured
    // on a consumer's phone, a line alone in an unchanged parent, its own box
    // the same size at both ends, arrived exactly 1.00px low every time.
    const blocks = lifting
      .map((stop, index) => {
        const stopAt = index === lifting.length - 1 ? Math.min(at(stop.at), arrived) : at(stop.at);
        return `  ${stopAt.toFixed(4)}% {\n${pinnedLiftDecl(stop.ascent)}\n    animation-timing-function: steps(1, end);\n  }`;
      })
      .join("\n");
    rules.push(`@keyframes ${liftName} {\n${blocks}\n}`);
    animations.push(`${liftName} ${clock} linear ${start}s both`);
  }

  if (tracking) {
    const trackName = `flemo-morph-${id}-track`;
    // Ramped between samples, unlike the lift beside it. The lift cancels a
    // staircase and has to be one; this cancels a smooth curve, and holding a
    // sample until the next one leaves the whole climb between them on the
    // glass. Same stops, same bytes, a third of the worst frame's error.
    const blocks = tracking
      .map((stop, index, all) => {
        const stopAt = index === all.length - 1 ? Math.min(at(stop.at), arrived) : at(stop.at);
        return `  ${stopAt.toFixed(4)}% {\n${pinnedTrackFixDecl(stop.fix)}\n  }`;
      })
      .join("\n");
    rules.push(`@keyframes ${trackName} {\n${blocks}\n}`);
    animations.push(`${trackName} ${clock} linear ${start}s both`);
  }

  if (paint.length > 0) {
    const paintName = `flemo-morph-${id}-paint`;
    const from = paint.map((channel) => `    ${channel.property}: ${channel.from};`).join("\n");
    const to = paint.map((channel) => `    ${channel.property}: ${channel.to};`).join("\n");
    rules.push(held(paintName, from, to));
    animations.push(`${paintName} ${clock} ${easing} ${start}s both`);
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
    transform,
    // WHOEVER WRITES THE CHANNEL MUST ALSO WEAR IT.
    //
    // The move channel is written for every `moving` set, and what it carries
    // is not only a box travel or a pose: a pair that rides its container has
    // NEITHER and still has an ascent to cancel and a half-leading to pay. This
    // asked for one of the two it happened to be built for, so a riding text
    // pair animated both registered properties with nothing reading them, and
    // the whole cancellation was dead on exactly the pairs a container
    // transform is made of. Measured on the poster grid: its title began every
    // flight a pixel above the line it was flying from.
    translate: moving ? PINNED_TRAVEL : null,
    size: sized ? { width: PINNED_BOX, height: PINNED_BOX_HEIGHT } : null,
    heldEdge: moving && rightHeld && box ? onRuler(box.to.x + box.to.width) : null,
    letterSpacing: tracking ? PINNED_TRACK : null
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
  /** The flight's flat lead-in, baked here too: the camera is one of its parts. */
  head?: number;
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
  // Same trade the element makes: the head is spent inside the animation, so a
  // late first frame lands in the lead-in rather than partway down the curve.
  const head = Math.max(0, Math.min(input.head ?? 0, start));
  const span = duration + head;
  const headPct = head > 0 ? (head / span) * 100 : 0;
  const delay = start - head;
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
    head > 0
      ? `@keyframes ${name} {\n  0%, ${headPct.toFixed(3)}% {\n${stop(!settling)}\n  }\n  100% {\n${stop(settling)}\n  }\n}`
      : `@keyframes ${name} {\n  from {\n${stop(!settling)}\n  }\n  to {\n${stop(settling)}\n  }\n}`,
    `${selector} {\n${accelerated ? "" : `  transform: ${PINNED_POSE_TRANSFORM} !important;\n`}  animation-name: ${name} !important;\n  animation-duration: ${span.toFixed(3)}s !important;\n  animation-timing-function: ${easingToCss(ease)} !important;\n  animation-delay: ${delay.toFixed(3)}s !important;\n  animation-fill-mode: both !important;\n}`
  ];
  return { rules, name };
};
