import type { TransitionTarget } from "@transition/cssTypes";

// A transform reduced to numbers. What the morph runtime composes — the
// measured travel and an author's flourish on top of it — is expressed here
// first and turned into CSS once, so composition is arithmetic instead of
// string surgery.
export interface MorphPose {
  /** Translation in px. */
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  /** Degrees. */
  rotate: number;
}

export interface PoseBox {
  width: number;
  height: number;
}

export interface PosePoint {
  x: number;
  y: number;
}

export const IDENTITY_POSE: MorphPose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0 };

// Lengths a transition can author for a translate channel, resolved against the
// box the value is relative to. Percentages are the common case (a screen
// slides by "100%" of its own width); px and unitless numbers pass through.
//
// Anything else — rem, vh, calc() — returns null rather than a guess. The
// caller treats a null as "this transform cannot be reproduced numerically"
// and takes the rect as measured instead. A wrong number would put a shared
// element somewhere it never was.
export const resolveLength = (raw: string | number | undefined, basis: number): number | null => {
  if (raw === undefined) return 0;
  if (typeof raw === "number") return raw;
  const value = raw.trim();
  if (value === "") return 0;
  if (value.endsWith("%")) {
    const percent = Number.parseFloat(value);
    return Number.isFinite(percent) ? (percent / 100) * basis : null;
  }
  if (value.endsWith("px")) {
    const px = Number.parseFloat(value);
    return Number.isFinite(px) ? px : null;
  }
  const bare = Number.parseFloat(value);
  return value === String(bare) && Number.isFinite(bare) ? bare : null;
};

const resolveScalar = (raw: string | number | undefined, fallback: number): number | null => {
  if (raw === undefined) return fallback;
  if (typeof raw === "number") return raw;
  const parsed = Number.parseFloat(raw.trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveAngle = (raw: string | number | undefined): number | null => {
  if (raw === undefined) return 0;
  if (typeof raw === "number") return raw;
  const value = raw.trim();
  if (value.endsWith("deg")) {
    const deg = Number.parseFloat(value);
    return Number.isFinite(deg) ? deg : null;
  }
  const bare = Number.parseFloat(value);
  return value === String(bare) && Number.isFinite(bare) ? bare : null;
};

/**
 * The transform channels of an authored target as numbers, or `null` when one
 * of them is a length this module cannot resolve (see resolveLength).
 */
export const resolvePose = (
  target: TransitionTarget | undefined | null,
  box: PoseBox
): MorphPose | null => {
  if (!target) return { ...IDENTITY_POSE };

  const x = resolveLength(target.x, box.width);
  const y = resolveLength(target.y, box.height);
  if (x === null || y === null) return null;

  const uniform = resolveScalar(target.scale, 1);
  if (uniform === null) return null;
  const scaleX = resolveScalar(target.scaleX, uniform);
  const scaleY = resolveScalar(target.scaleY, uniform);
  if (scaleX === null || scaleY === null) return null;

  const rotate = resolveAngle(target.rotate ?? target.rotateZ);
  if (rotate === null) return null;

  return { x, y, scaleX, scaleY, rotate };
};

/** Whether an authored target moves anything this module represents. */
export const poseIsIdentity = (pose: MorphPose): boolean =>
  pose.x === 0 && pose.y === 0 && pose.scaleX === 1 && pose.scaleY === 1 && pose.rotate === 0;

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * One pose as a CSS transform value. `translate3d` rather than translateX/Y for
 * the same reason the keyframes compiler uses it: Chromium pixel-snaps a
 * 2D-transform-animated layer on raster-heavy content, and the 3D form keeps
 * the layer on the texture-filtered path that slides sub-pixel smoothly.
 */
export const poseToCss = (pose: MorphPose): string => {
  if (poseIsIdentity(pose)) return "none";
  const parts: string[] = [];
  if (pose.x !== 0 || pose.y !== 0) {
    parts.push(`translate3d(${round(pose.x)}px, ${round(pose.y)}px, 0)`);
  }
  if (pose.scaleX !== 1 || pose.scaleY !== 1) {
    parts.push(`scale(${round(pose.scaleX)}, ${round(pose.scaleY)})`);
  }
  if (pose.rotate !== 0) parts.push(`rotate(${round(pose.rotate)}deg)`);
  return parts.join(" ");
};

/**
 * Several poses as ONE transform value, outermost first.
 *
 * Concatenation IS composition in CSS — `transform: A B` maps a point through B
 * and then A — so the runtime never multiplies matrices. That is what lets the
 * measured travel and an author's flourish stack on one element instead of
 * needing a wrapper each.
 */
export const composePoses = (poses: MorphPose[]): MorphPose[] =>
  poses.filter((pose) => !poseIsIdentity(pose));

export const composePosesToCss = (poses: MorphPose[]): string => {
  const parts = composePoses(poses).map(poseToCss);
  return parts.length === 0 ? "none" : parts.join(" ");
};

// A POSE THE COMPOSITOR CANNOT RUN, AND WHY ONE IS NEEDED.
//
// A transform is one of the few things a compositor can animate by itself, so
// an animation of one advances every vsync whatever the page is doing. That is
// usually the point. It is exactly wrong for the things in a flight that are
// not animations in their own right: a GHOST is a copy of the departure whose
// whole job is to sit on the element it is dissolving into, and a CAMERA is
// defined as precisely the zoom that carries the element from one end of the
// flight to the other. Both are defined RELATIVE to an element that travels by
// its box, which no compositor can interpolate, and which therefore only
// advances on the frames the main thread manages to produce.
//
// Sampled off the `Animation` objects, the pair agrees: same `startTime`, same
// `currentTime`, computed progress within a thousandth. They disagree only in
// what reaches the glass. Isolated on both engines with the main thread blocked
// mid-flight, a transform twin of a box travel ran 146px (Blink) and 167px
// (WebKit) ahead of it, over a travel of 280px, before the box moved at all.
//
// Composing the transform from REGISTERED custom properties is what takes it
// off the compositor, because substituting them is style resolution's work. It
// is the ONLY lever that does. Measured and rejected first, all still
// accelerated on both engines: `calc(var())` in the animation timing, which
// this codebase already knew took a fade off WebKit's compositor; constant
// `left`, `background-color` and `clip-path` channels beside the transform; and
// a registered property animated as an extra channel while the transform stayed
// literal. A single `<transform-list>` property would be the tidiest form and is
// not portable — WebKit refuses to register that syntax at all.
//
// It costs nothing measurable: the element keeps its layer, so a frame is a
// style resolution and a transform update, and frame times were
// indistinguishable from the literal form at 1x, 6x and 12x CPU throttle.
const PINNED = {
  x: "--flemo-pose-x",
  y: "--flemo-pose-y",
  scaleX: "--flemo-pose-sx",
  scaleY: "--flemo-pose-sy",
  rotate: "--flemo-pose-r"
} as const;

// The travel's own coordinates. A flight's POSITION moves by `translate` so
// that the glyphs on it are painted from a transform rather than from a layout
// box (see morphKeyframes), and `translate` is one of the few things WebKit
// will run on the compositor EVEN WHERE THE SAME KEYFRAME ANIMATES A SIZE:
// measured with the main thread blocked, a keyframe animating `translate` and
// `width` together kept moving while a keyframe animating `width` alone stood
// still. That is the position of a line of type running ahead of its own size,
// which is the text arriving late that it reads as.
//
// So the travel is driven through registered properties too, which no
// compositor can run, and the flight stays on one thread while keeping the
// painting a transform gives it.
const TRAVEL = { x: "--flemo-move-x", y: "--flemo-move-y", lift: "--flemo-lift-y" } as const;

// The two halves of a type morph's tracking. The author's travels on the
// flight's own curve; the correction that keeps the glyphs from drifting apart
// holds and steps (see morphLine). One property, two clocks, the same way the
// travel carries its lift.
const TRACK = { authored: "--flemo-track", fix: "--flemo-track-fix" } as const;

/** The `letter-spacing` an element wears while its tracking is corrected. */
export const PINNED_TRACK = `calc(var(${TRACK.authored}) + var(${TRACK.fix}))`;

/** One end of the authored tracking. */
export const pinnedTrackDecl = (value: number, indent = "    "): string =>
  `${indent}${TRACK.authored}: ${round(value)}px;`;

/** One stop of the correction that keeps a run from drifting apart. */
export const pinnedTrackFixDecl = (value: number, indent = "    "): string =>
  `${indent}${TRACK.fix}: ${round(value)}px;`;

// TWO CLOCKS ON ONE PROPERTY.
//
// A flight's position eases; the ascent it has to cancel climbs in steps (see
// morphLine). Those are two timings, and one property can only carry one
// keyframe — which is why the cancellation used to need a SECOND property, and
// why it was refused wherever that property was already spoken for: a nested
// pair riding its container writes its own transform, and had nowhere to put
// it. The poster grid showed the result as a title starting an ascent too high.
//
// A `calc` of two registered properties carries both. Each is animated by its
// own keyframe on its own timing, and the value they add up to is the one the
// element wears. Verified on both engines, sampled either side of every step:
// the sum tracked the eased travel plus the held lift exactly.
export const PINNED_TRAVEL = `var(${TRAVEL.x}) calc(var(${TRAVEL.y}) + var(${TRAVEL.lift}))`;

/** One end of a pinned travel, as the keyframe declarations that drive it. */
export const pinnedTravelDecls = (x: number, y: number, indent = "    "): string =>
  `${indent}${TRAVEL.x}: ${round(x)}px;\n${indent}${TRAVEL.y}: ${round(y)}px;`;

/** One stop of the ascent's staircase, on the half of the pair that holds. */
export const pinnedLiftDecl = (ascent: number, indent = "    "): string =>
  `${indent}${TRAVEL.lift}: ${round(-ascent)}px;`;

/** The `transform` an element wears while its pose is pinned. */
export const PINNED_POSE_TRANSFORM = `translate3d(var(${PINNED.x}), var(${PINNED.y}), 0) scale(var(${PINNED.scaleX}), var(${PINNED.scaleY})) rotate(var(${PINNED.rotate}))`;

/**
 * The registrations the pinned form needs, inserted once per document.
 *
 * They have to be REGISTERED: an unregistered custom property is a string to
 * the engine and animates discretely, which would teleport a pose at its
 * midpoint instead of interpolating it.
 *
 * One set of names for every flight rather than one per participant, because a
 * registration is document-wide and re-registering invalidates style for the
 * whole page. `inherits: false` is what makes that safe: each element holds its
 * own values, so two flights never read each other's and no descendant inherits
 * a pose meant for its parent.
 */
export const PINNED_POSE_PROPERTY_RULES = [
  `@property ${TRAVEL.x} {\n  syntax: "<length>";\n  inherits: false;\n  initial-value: 0px;\n}`,
  `@property ${TRAVEL.y} {\n  syntax: "<length>";\n  inherits: false;\n  initial-value: 0px;\n}`,
  `@property ${TRAVEL.lift} {\n  syntax: "<length>";\n  inherits: false;\n  initial-value: 0px;\n}`,
  `@property ${TRACK.authored} {\n  syntax: "<length>";\n  inherits: false;\n  initial-value: 0px;\n}`,
  `@property ${TRACK.fix} {\n  syntax: "<length>";\n  inherits: false;\n  initial-value: 0px;\n}`,
  `@property ${PINNED.x} {\n  syntax: "<length>";\n  inherits: false;\n  initial-value: 0px;\n}`,
  `@property ${PINNED.y} {\n  syntax: "<length>";\n  inherits: false;\n  initial-value: 0px;\n}`,
  `@property ${PINNED.scaleX} {\n  syntax: "<number>";\n  inherits: false;\n  initial-value: 1;\n}`,
  `@property ${PINNED.scaleY} {\n  syntax: "<number>";\n  inherits: false;\n  initial-value: 1;\n}`,
  `@property ${PINNED.rotate} {\n  syntax: "<angle>";\n  inherits: false;\n  initial-value: 0deg;\n}`
];

/**
 * One pose as the keyframe declarations that drive `PINNED_POSE_TRANSFORM`.
 *
 * Every channel is written at both ends even where it does not change, because
 * these are the coordinates of one transform rather than five animations: an
 * end that omitted a channel would interpolate it from its registered initial
 * value instead of holding it.
 */
export const pinnedPoseDecls = (pose: MorphPose, indent = "    "): string =>
  [
    `${indent}${PINNED.x}: ${round(pose.x)}px;`,
    `${indent}${PINNED.y}: ${round(pose.y)}px;`,
    `${indent}${PINNED.scaleX}: ${round(pose.scaleX)};`,
    `${indent}${PINNED.scaleY}: ${round(pose.scaleY)};`,
    `${indent}${PINNED.rotate}: ${round(pose.rotate)}deg;`
  ].join("\n");

export const interpolatePose = (from: MorphPose, to: MorphPose, progress: number): MorphPose => ({
  x: from.x + (to.x - from.x) * progress,
  y: from.y + (to.y - from.y) * progress,
  scaleX: from.scaleX + (to.scaleX - from.scaleX) * progress,
  scaleY: from.scaleY + (to.scaleY - from.scaleY) * progress,
  rotate: from.rotate + (to.rotate - from.rotate) * progress
});
