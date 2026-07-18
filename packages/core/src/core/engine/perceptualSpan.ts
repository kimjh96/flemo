// Perceptual completion cut: the moment a transition's remaining motion drops
// below what a display can show, the rest of its clock is dead air.
//
// A deceleration curve like cupertino's approaches its target asymptotically:
// the last fraction of a percent of the distance — under one device pixel —
// can occupy 150ms+ of the duration. Nothing presentable happens in that
// window, but the screen sits at sub-pixel offsets, so every glyph
// re-rasterizes at shifting anti-aliasing phases; on scaled display pipelines
// (device emulation, HiDPI downscaling) that renders as a fine text shimmer
// exactly at the convergence — measured on a user capture as full-page AA
// pulses with zero integer-pixel movement. Ending the transition at the point
// where EVERY animated channel has permanently entered its imperceptibility
// band (translation: one device pixel; opacity: one 8-bit step) presents
// pixels identical to the authored motion — sub-pixel by definition — while
// removing the shimmer window entirely. This is cost placement, not motion
// editing: the authored curve is preserved to the last visible pixel.

import { resolveEasing } from "@transition/cubicBezier";
import type { MotionTarget, VariantMotion } from "@transition/variantMotion";

// One 8-bit alpha/opacity step.
const OPACITY_EPSILON = 1 / 255;

// Easing-band scan resolution. 400 samples on a ≤1s motion places the cut
// within ~2.5ms of the exact crossing — far below a frame.
const SAMPLES = 400;

// The minimum clock saving that justifies cutting at all.
const MIN_SAVING_MS = 24;

// Channels this analysis understands. A motion touching anything else
// (filters, colors, scale, author extensions) skips the cut entirely —
// correctness over savings.
const KNOWN_CHANNELS = new Set(["x", "y", "opacity"]);

export interface PerceptualBox {
  clientWidth: number;
  clientHeight: number;
}

const channelValue = (
  target: MotionTarget,
  key: string,
  box: PerceptualBox
): number | null | undefined => {
  if (!target || typeof target !== "object") return undefined;
  const raw = (target as Record<string, unknown>)[key];
  if (raw === undefined) return undefined;
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.endsWith("%")) {
    const scalar = Number(trimmed.slice(0, -1));
    if (Number.isNaN(scalar)) return null;
    const basis = key === "y" ? box.clientHeight : box.clientWidth;
    return (scalar / 100) * basis;
  }
  if (trimmed.endsWith("px")) {
    const scalar = Number(trimmed.slice(0, -2));
    return Number.isNaN(scalar) ? null : scalar;
  }
  return null;
};

// The imperceptibility band of one motion, as a fraction of value progress:
// the tightest channel wins. Returns null when any channel cannot be
// reasoned about (unknown property, unparsable unit) — the caller then lets
// the animation run to its natural end.
const imperceptibleFraction = (
  motion: VariantMotion,
  box: PerceptualBox,
  devicePixelRatio: number
): number | null => {
  const keys = new Set<string>();
  for (const target of [motion.from, motion.to]) {
    if (!target || typeof target !== "object") continue;
    for (const key of Object.keys(target)) keys.add(key);
  }
  if (keys.size === 0) return null;

  let band = Infinity;
  for (const key of keys) {
    if (!KNOWN_CHANNELS.has(key)) return null;
    const from = channelValue(motion.from, key, box);
    const to = channelValue(motion.to, key, box);
    if (from === null || to === null) return null;
    // A channel present on one side only: its counterpart is unknown, not
    // zero — CSS would fall back to the property's current value. Bail.
    if (from === undefined || to === undefined) return null;
    const distance = Math.abs(to - from);
    if (distance === 0) continue;
    const threshold = key === "opacity" ? OPACITY_EPSILON : 1 / Math.max(1, devicePixelRatio);
    band = Math.min(band, threshold / distance);
  }
  if (!Number.isFinite(band) || band <= 0 || band >= 1) return null;
  return band;
};

// The earliest time (ms from animation start, delay included) after which the
// eased value stays inside the imperceptibility band for the REST of the
// motion — a backward scan, so overshooting eases (backOut) that re-exit the
// band are handled correctly. Null when cutting is unsafe or saves nothing.
export const perceptualCutMs = (
  motion: VariantMotion,
  box: PerceptualBox,
  devicePixelRatio: number
): number | null => {
  if (motion.duration <= 0) return null;
  const band = imperceptibleFraction(motion, box, devicePixelRatio);
  if (band === null) return null;

  const easing = resolveEasing(motion.ease);
  let firstInside = SAMPLES;
  for (let i = SAMPLES; i >= 0; i -= 1) {
    if (Math.abs(1 - easing(i / SAMPLES)) > band) break;
    firstInside = i;
  }
  // Inside the band from t=0: nothing here to reason about (a degenerate or
  // near-constant motion) — let it play.
  if (firstInside === 0) return null;

  const cut = (motion.delay + motion.duration * (firstInside / SAMPLES)) * 1000;
  const full = (motion.delay + motion.duration) * 1000;
  if (full - cut < MIN_SAVING_MS) return null;
  return cut;
};
