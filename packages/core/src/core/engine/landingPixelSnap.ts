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

// The landing governor, expressed as an easing reshape for the COMPILED
// tier (the numeric player applies the same rule per frame in
// composeTransform; a compiled animation's tail can only be governed
// through its timing function). From the moment the authored curve can no
// longer sustain one device pixel per frame inside the engagement range,
// the curve continues at EXACTLY that velocity — a straight linear() sprint
// to rest — and then holds 1. No integer plateaus (the eye-rejected texel
// stepping): the presented offsets stay fractional, just never slower than
// the crisp minimum, so the last-gap sliver closes in rhythm instead of
// parking short and ticking in at the COMPLETED flip.
const GOVERNOR_MAX_DEVICE_PX = 12;

export const governedEasingForMotion = (
  motion: VariantMotion,
  box: PerceptualBox,
  devicePixelRatio: number,
  frameIntervalMs: number
): string | null => {
  if (motion.duration <= 0) return null;
  if (!Number.isFinite(frameIntervalMs) || frameIntervalMs <= 0) return null;
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
    if (rawFrom !== undefined && rawFrom === rawTo) continue;
    // The reshaped easing drives every animated channel: only pure x/y
    // motions are governed (same conservatism as the snap reshape).
    if (key !== "x" && key !== "y") return null;
    const from = channelValue(motion.from, key, box);
    const to = channelValue(motion.to, key, box);
    if (from === null || to === null || from === undefined || to === undefined) return null;
    dominantDevice = Math.max(dominantDevice, Math.abs(to - from) * dpr);
  }
  if (dominantDevice < GOVERNOR_MAX_DEVICE_PX) return null;

  const easing = resolveEasing(motion.ease);
  const y = new Array<number>(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i += 1) y[i] = easing(i / SAMPLES);

  const durationMs = motion.duration * 1000;
  const sampleMs = durationMs / SAMPLES;
  // Per-sample progress equivalent of one device pixel per frame.
  const perFrameLimit = (1 / dominantDevice) * (sampleMs / frameIntervalMs);
  // Engagement: the last sample after which the velocity permanently stays
  // below one device pixel per frame AND the remainder is inside range.
  let engage = SAMPLES;
  let fastest = 0;
  for (let i = SAMPLES - 1; i >= 0; i -= 1) {
    fastest = Math.max(fastest, Math.abs(y[i + 1] - y[i]));
    if (fastest > perFrameLimit) break;
    engage = i;
  }
  if (engage === 0 || engage >= SAMPLES) return null;
  // Monotone approach only — overshoot keeps its authored bounce.
  for (let i = engage; i < SAMPLES; i += 1) {
    if (y[i + 1] < y[i] || y[i] > 1) return null;
  }
  const remainingDevice = (1 - y[engage]) * dominantDevice;
  if (remainingDevice <= 1 || remainingDevice > GOVERNOR_MAX_DEVICE_PX) return null;

  // Close the remainder at one device pixel per frame from the engagement
  // point; the curve then rests at 1 for whatever authored time is left. If
  // the sprint would outlast the animation, the authored tail was already
  // faster — nothing to fix.
  const engagePct = (engage / SAMPLES) * 100;
  const sprintMs = remainingDevice * frameIntervalMs;
  const sprintPct = (sprintMs / durationMs) * 100;
  if (engagePct + sprintPct >= 100) return null;

  const points: string[] = [];
  for (let i = 0; i <= engage; i += FAST_PHASE_STRIDE) {
    points.push(`${format(y[i])} ${format((i / SAMPLES) * 100)}%`);
  }
  points.push(`${format(y[engage])} ${format(engagePct)}%`);
  points.push(`1 ${format(engagePct + sprintPct)}%`, "1 100%");
  return `linear(${points.join(", ")})`;
};

// ── Governed BEZIER for accelerated WebKit (touch compiled tier) ────────────
//
// The player's landing governor gives its tail a firm, early landing (one
// device pixel per frame from the engagement point); the routed compiled
// tier on touch WebKit plays the authored bezier's asymptotic tail instead —
// eye-flagged on device as a DIFFERENT ending feel from the player the
// product's texture is calibrated to. The linear() reshape that closes this
// on Blink (governedEasingForMotion) is unavailable here: Core Animation
// timing is bezier-only, and a linear() easing demonstrably knocks WebKit's
// animation off the accelerated path — the very immunity this tier exists
// for. So the governor is expressed as the ONE form CA accepts: a plain
// cubic bezier, least-max-error fitted to the governed curve (the authored
// easing truncated at its landing point, plus the 1-device-px-per-frame
// sprint), over a SHORTENED duration ending exactly at that landing. Both
// land inline (animation-timing-function + animation-duration); the fit is
// cached per curve/travel/cadence bucket, and any fit that cannot stay
// within FIT_TOLERANCE of the governed curve bails to the authored easing.
const FIT_SAMPLES = 48;
// Position-weighted tolerance: the head races at 20+ device px per frame,
// where a few percent of positional deviation is motion blur; the TAIL is
// the whole point of the governor — the landing must track the sprint
// tightly or the firm ending this exists for washes back out.
const FIT_TOLERANCE_HEAD = 0.05;
const FIT_TOLERANCE_TAIL = 0.012;
const FIT_TAIL_FROM = 0.7;
const bezierFitCache = new Map<string, { easing: string; durationMs: number } | null>();

const fitCubicBezier = (target: (u: number) => number): [number, number, number, number] | null => {
  // Pre-sampled target and per-sample allowances; two sample densities (a
  // sparse set steers the coarse grid, the full set decides) plus
  // prune-against-best keep the whole search around ~10ms — paid once per
  // curve/travel/cadence bucket, then cached.
  const buildSamples = (count: number): [number, number, number][] =>
    Array.from({ length: count - 1 }, (_, i) => {
      const u = (i + 1) / count;
      return [u, target(u), u >= FIT_TAIL_FROM ? FIT_TOLERANCE_TAIL : FIT_TOLERANCE_HEAD];
    });
  const sparse = buildSamples(12);
  const full = buildSamples(FIT_SAMPLES);
  const errorOf = (
    p: [number, number, number, number],
    samples: [number, number, number][],
    pruneAt: number
  ): number => {
    const candidate = resolveEasing(p);
    let worst = 0;
    for (const [u, value, allowed] of samples) {
      const err = Math.abs(candidate(u) - value) / allowed;
      if (err > worst) worst = err;
      if (worst >= pruneAt) break;
    }
    return worst;
  };
  let best: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
  let bestErr = errorOf(best, full, Infinity);
  const search = (
    center: [number, number, number, number],
    radius: number,
    step: number,
    samples: [number, number, number][]
  ) => {
    for (
      let x1 = Math.max(0, center[0] - radius);
      x1 <= Math.min(1, center[0] + radius);
      x1 += step
    ) {
      for (
        let y1 = Math.max(0, center[1] - radius);
        y1 <= Math.min(1, center[1] + radius);
        y1 += step
      ) {
        for (
          let x2 = Math.max(0, center[2] - radius);
          x2 <= Math.min(1, center[2] + radius);
          x2 += step
        ) {
          for (
            let y2 = Math.max(0, center[3] - radius);
            y2 <= Math.min(1, center[3] + radius);
            y2 += step
          ) {
            const p: [number, number, number, number] = [x1, y1, x2, y2];
            const err = errorOf(p, samples, bestErr);
            if (err < bestErr) {
              bestErr = err;
              best = p;
            }
          }
        }
      }
    }
  };
  search([0.5, 0.5, 0.5, 0.5], 0.5, 0.25, sparse);
  search(best, 0.125, 0.05, sparse);
  bestErr = errorOf(best, full, Infinity); // re-judge the sparse winner fully
  search(best, 0.03, 0.01, full);
  return bestErr <= 1 ? best : null;
};

export const governedBezierForMotion = (
  motion: VariantMotion | null,
  box: PerceptualBox,
  devicePixelRatio: number,
  frameIntervalMs: number
): { easing: string; durationMs: number } | null => {
  if (!motion || motion.duration <= 0) return null;
  if (!Number.isFinite(frameIntervalMs) || frameIntervalMs <= 0) return null;
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
    if (rawFrom !== undefined && rawFrom === rawTo) continue;
    if (key !== "x" && key !== "y") return null;
    const from = channelValue(motion.from, key, box);
    const to = channelValue(motion.to, key, box);
    if (from === null || to === null || from === undefined || to === undefined) return null;
    dominantDevice = Math.max(dominantDevice, Math.abs(to - from) * dpr);
  }
  if (dominantDevice < GOVERNOR_MAX_DEVICE_PX) return null;

  const cacheKey = `${JSON.stringify(motion.ease)}|${motion.duration}|${Math.round(dominantDevice / 8)}|${Math.round(frameIntervalMs)}`;
  const cached = bezierFitCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const easing = resolveEasing(motion.ease);
  const y = new Array<number>(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i += 1) y[i] = easing(i / SAMPLES);

  const durationMs = motion.duration * 1000;
  const sampleMs = durationMs / SAMPLES;
  const perFrameLimit = (1 / dominantDevice) * (sampleMs / frameIntervalMs);
  let engage = SAMPLES;
  let fastest = 0;
  for (let i = SAMPLES - 1; i >= 0; i -= 1) {
    fastest = Math.max(fastest, Math.abs(y[i + 1]! - y[i]!));
    if (fastest > perFrameLimit) break;
    engage = i;
  }
  const bail = (): null => {
    bezierFitCache.set(cacheKey, null);
    return null;
  };
  if (engage === 0 || engage >= SAMPLES) return bail();
  for (let i = engage; i < SAMPLES; i += 1) {
    if (y[i + 1]! < y[i]! || y[i]! > 1) return bail();
  }
  const remainingDevice = (1 - y[engage]!) * dominantDevice;
  if (remainingDevice <= 1 || remainingDevice > GOVERNOR_MAX_DEVICE_PX) return bail();

  const engageMs = (engage / SAMPLES) * durationMs;
  const sprintMs = remainingDevice * frameIntervalMs;
  const landMs = engageMs + sprintMs;
  if (landMs >= durationMs) return bail();

  const yEngage = y[engage]!;
  const governed = (u: number): number => {
    const t = u * landMs;
    if (t <= engageMs) return easing(t / durationMs);
    return yEngage + (1 - yEngage) * ((t - engageMs) / sprintMs);
  };
  const fit = fitCubicBezier(governed);
  if (!fit) return bail();
  const result = {
    easing: `cubic-bezier(${format(fit[0])}, ${format(fit[1])}, ${format(fit[2])}, ${format(fit[3])})`,
    durationMs: Math.round(landMs)
  };
  bezierFitCache.set(cacheKey, result);
  return result;
};
