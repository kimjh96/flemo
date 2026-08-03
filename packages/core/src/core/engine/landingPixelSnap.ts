import { resolveEasing } from "@transition/cubicBezier";

import type { VariantMotion } from "@transition/variantMotion";

import { channelValue, type PerceptualBox } from "@core/engine/perceptualSpan";

// Landing pixel snap: the convergence tail presented on integer device
// pixels, by reshaping the compiled animation's own easing.
//
// Blink composites a transformed layer at its exact fractional offset,
// bilinear-filtering the texture between device pixels. At half-pixel phases
// the filter averages adjacent texels — high-frequency content (gradient
// dither, glyph AA edges) washes out; at integer phases it passes through
// crisp (shift-compensated captures: an integer-stepped promoted layer
// diffs to EXACTLY zero — texels move rigidly — while fractional offsets
// collapse the texture's gradient energy ~8x). During the fast part of a
// flight the phase sweeps several pixels per frame and reads as motion; the
// decelerating tail LINGERS on each phase for multiple frames, so the whole
// layer's texture visibly pulses on the settle frames — worse the wider the
// viewport. WebKit pixel-snaps composited offsets; this is the Chrome-only
// remainder of the convergence jank.
//
// HOW the snap is applied matters as much as the snap itself. A second
// animation overlaid on `transform` (WAAPI steps) forces Blink off the
// compositor for the REST OF THE FLIGHT — traced as Animation
// compositeFailed=64, kTargetHasIncompatibleAnimations — handing the motion
// to the main thread exactly where the eye is watching. So instead, the
// engine reshapes the ONE compiled animation via an inline
// `animation-timing-function: linear(...)`: the authored curve is sampled
// densely through its fast phase, and from the moment its velocity drops
// below the shimmer threshold the curve is re-encoded as plateaus-and-jumps
// that land each frame on an integer device pixel of the dominant channel.
// One animation, still compositor-driven, same animationend/recovery
// contracts, same authored timeline — the presented offsets simply step
// across the device grid instead of oozing between pixels.
//
// Positional deviation from the authored curve is bounded by one device
// pixel through the tail (each plateau holds the position's ceiling) and by
// the sampling density in the fast phase — both below anything the
// perceptual cut already deems imperceptible. Conservative bails mirror
// perceptualSpan: only pure x/y translations (an animating opacity shares
// the reshaped easing, so it would visibly step — bail; scale/rotate or
// unresolvable units — bail), and a curve that overshoots inside the snap
// band falls back to the authored easing.

// The takeover threshold: once the authored curve's velocity permanently
// drops below this many device pixels per frame, the eye can TRACK the
// moving content — and tracked text at fractional offsets reads as sizzle
// (both screens of a push/pop, the whole trackable span, on any
// text-weighted app). Smooth pursuit keeps glyphs foveated well past a
// thousand device px/s (the pop-returning parallax is tracked from its very
// first frame), so the threshold sits at the top of the pursuit range;
// above it, per-frame travel out-runs the eye and the filtering reads as
// ordinary motion blur. Within the band, a device pixel's plateau is
// shorter than a frame for all but the slowest tail, so snapping equals
// per-frame integer rounding — crisp glyphs, no added stepping. Judged at
// the fastest cadence in the wild (ProMotion) — a 60Hz display crosses
// earlier in per-frame terms, which only widens the band.
export const SNAP_VELOCITY_DEVICE_PX_PER_FRAME = 40;
const FRAME_MS = 1000 / 120;

// Plateau budget: one linear() plateau per device pixel of snapped travel.
// 480 covers the trackable span of a full-width retina flight; beyond it
// the band is clipped (partial coverage beats none). A motion that never
// exceeds the threshold (the parallax side at ordinary widths) snaps for
// its WHOLE flight, budget permitting.
export const SNAP_BAND_MAX_DEVICE_PX = 480;

// Below this dominant travel there is nothing worth snapping.
const MIN_DOMINANT_DEVICE_PX = 4;

// Curve-scan resolution (matching perceptualSpan) and the fast-phase
// emission stride: a point every 4 samples ≈ every 7ms of a 0.7s motion.
const SAMPLES = 400;
const FAST_PHASE_STRIDE = 4;

const format = (value: number) => {
  const rounded = +value.toFixed(5);
  return Object.is(rounded, -0) ? 0 : rounded;
};

// Reshape `motion`'s easing into a snap-tailed CSS linear() function, or
// null when snapping is unsafe or pointless (the caller then leaves the
// authored easing alone).
export const snappedEasingForMotion = (
  motion: VariantMotion,
  box: PerceptualBox,
  devicePixelRatio: number
): string | null => {
  if (motion.duration <= 0) return null;
  // Any valid positive DPR is the real device grid — including < 1 (browser
  // zoom-out on a 1x display); only a non-finite/zero/negative value falls
  // back to 1. Clamping sub-1 up to 1 would snap to CSS pixels, not device
  // pixels.
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;

  const keys = new Set<string>();
  for (const target of [motion.from, motion.to]) {
    if (!target || typeof target !== "object") continue;
    for (const key of Object.keys(target)) keys.add(key);
  }
  let dominantDevice = 0;
  for (const key of keys) {
    const rawFrom =
      motion.from && typeof motion.from === "object"
        ? (motion.from as Record<string, unknown>)[key]
        : undefined;
    const rawTo =
      motion.to && typeof motion.to === "object"
        ? (motion.to as Record<string, unknown>)[key]
        : undefined;
    // Constants don't interpolate and don't mind the easing.
    if (rawFrom !== undefined && rawFrom === rawTo) continue;
    // The reshaped easing drives EVERY animated channel of this variant: a
    // stepped opacity (or any non-translation channel) would be visible, so
    // only pure x/y motions are reshaped — correctness over savings.
    if (key !== "x" && key !== "y") return null;
    const from = channelValue(motion.from, key, box);
    const to = channelValue(motion.to, key, box);
    if (from === null || to === null || from === undefined || to === undefined) return null;
    dominantDevice = Math.max(dominantDevice, Math.abs(to - from) * dpr);
  }
  if (dominantDevice < MIN_DOMINANT_DEVICE_PX) return null;

  const easing = resolveEasing(motion.ease);
  const y = new Array<number>(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i += 1) y[i] = easing(i / SAMPLES);

  // The velocity crossing: the first sample after which the eased velocity
  // permanently stays below the shimmer threshold (suffix-maximum scan, so
  // a curve that briefly re-accelerates starts the band after its LAST fast
  // stretch).
  const durationMs = motion.duration * 1000;
  const sampleMs = durationMs / SAMPLES;
  const velocityLimit =
    ((SNAP_VELOCITY_DEVICE_PX_PER_FRAME / dominantDevice) * sampleMs) / FRAME_MS;
  let crossing = SAMPLES;
  let fastest = 0;
  for (let i = SAMPLES - 1; i >= 0; i -= 1) {
    fastest = Math.max(fastest, Math.abs(y[i + 1] - y[i]));
    if (fastest > velocityLimit) break;
    crossing = i;
  }
  // A crossing of 0 means the motion never out-runs pursuit: the WHOLE
  // flight is trackable and snaps end to end (the budget clip below still
  // bounds the plateau count).

  // Inside the band the approach must be monotone toward rest: an overshoot
  // would need signed plateaus on both sides of rest — authored bounce is
  // preserved instead (bail).
  for (let i = crossing; i < SAMPLES; i += 1) {
    if (y[i + 1] < y[i] || y[i] > 1) return null;
  }

  // Clip the band to the plateau budget: if more travel than the budget
  // remains at the crossing, start the plateaus later.
  const remainingAtCrossing = (1 - y[crossing]) * dominantDevice;
  if (remainingAtCrossing <= 1) return null;
  const band = Math.min(SNAP_BAND_MAX_DEVICE_PX, Math.floor(remainingAtCrossing));

  // The moment remaining travel permanently drops within k device pixels,
  // at SUB-SAMPLE precision (linear interpolation between samples): at band
  // entry the curve can still move several pixels per sample, and a
  // grid-quantized boundary there would hold a pixel visibly early. The
  // walking pointer stays monotone as k descends (the band is monotone —
  // enforced above).
  let pointer = crossing;
  const entryPct = (k: number): number => {
    const target = 1 - k / dominantDevice;
    while (pointer < SAMPLES && y[pointer] < target) pointer += 1;
    if (pointer === 0) return 0;
    const y0 = y[pointer - 1];
    const y1 = y[pointer];
    const within = y1 === y0 ? 1 : Math.max(0, Math.min(1, (target - y0) / (y1 - y0)));
    return ((pointer - 1 + within) / SAMPLES) * 100;
  };

  const startPct = entryPct(band);
  const points: string[] = [];
  // Fast phase: the authored curve, sampled densely.
  for (let i = 0; i * (100 / SAMPLES) < startPct; i += FAST_PHASE_STRIDE) {
    points.push(`${format(y[i])} ${format((i / SAMPLES) * 100)}%`);
  }
  // Tail: one plateau per integer device pixel — hold the pixel's progress
  // from its entry to the next pixel's entry, then jump (a duplicated input
  // percentage is a discontinuity in linear()). Rest is reached at the SAME
  // crossing the perceptual cut uses (remaining permanently < 1 device px),
  // so by the COMPLETED flip the presented position IS the rest rule's —
  // the animation's removal presents nothing.
  let enterAt = startPct;
  for (let k = band; k >= 2; k -= 1) {
    const leaveAt = entryPct(k - 1);
    if (leaveAt > enterAt) {
      const progress = format(1 - k / dominantDevice);
      points.push(`${progress} ${format(enterAt)}%`, `${progress} ${format(leaveAt)}%`);
    }
    enterAt = leaveAt;
  }
  points.push(`1 ${format(enterAt)}%`, "1 100%");

  return `linear(${points.join(", ")})`;
};
