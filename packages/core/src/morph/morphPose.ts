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
export const composePosesToCss = (poses: MorphPose[]): string => {
  const parts = poses.filter((pose) => !poseIsIdentity(pose)).map(poseToCss);
  return parts.length === 0 ? "none" : parts.join(" ");
};

export const interpolatePose = (from: MorphPose, to: MorphPose, progress: number): MorphPose => ({
  x: from.x + (to.x - from.x) * progress,
  y: from.y + (to.y - from.y) * progress,
  scaleX: from.scaleX + (to.scaleX - from.scaleX) * progress,
  scaleY: from.scaleY + (to.scaleY - from.scaleY) * progress,
  rotate: from.rotate + (to.rotate - from.rotate) * progress
});
