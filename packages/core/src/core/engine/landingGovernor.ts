import { resolveEasing } from "@transition/cubicBezier";

import type { VariantMotion } from "@transition/variantMotion";

import { channelValue, type PerceptualBox } from "@core/engine/perceptualSpan";

// The LANDING GOVERNOR for the compiled tier: keep a flight's convergence
// tail moving at no less than one device pixel per frame, by reshaping the
// compiled animation's own timing function.
//
// A compiled animation's tail can only be governed through its easing — a
// second animation overlaid on `transform` forces Blink off the compositor
// for the rest of the flight (traced as Animation compositeFailed=64,
// kTargetHasIncompatibleAnimations), handing the motion to the main thread
// exactly where the eye is watching. So the engine reshapes the ONE compiled
// animation via an inline `animation-timing-function: linear(...)`: the
// authored curve is sampled densely through its fast phase, and from the
// moment its velocity can no longer sustain one device pixel per frame the
// curve continues at EXACTLY that velocity — a straight sprint to rest —
// then holds 1. One animation, still compositor-driven, same animationend and
// recovery contracts, same authored timeline; the last-gap sliver simply
// closes in rhythm instead of parking short and ticking in at the COMPLETED
// flip.
//
// The presented offsets stay FRACTIONAL. An earlier form of this module also
// snapped the tail onto integer device pixels (plateaus-and-jumps, so Blink's
// bilinear filter passed the texture through crisp), behind the opt-in
// `flemo:landing-snap` flag. A live A/B on real content judged texel-rigid
// stepping WORSE than the authored fractional glide — the same verdict as the
// transformPart 2D-vs-3D experiment, where translate3d was chosen precisely
// FOR filtered sub-pixel compositing — so the snap reshape was removed with
// the rAF player. Do not re-derive it: the falsification is the finding.
//
// Conservative bails mirror perceptualSpan: only pure x/y translations (an
// animating opacity would share the reshaped easing and visibly step — bail;
// scale/rotate or unresolvable units — bail), and a non-monotone approach
// keeps its authored bounce.

// Curve-scan resolution (matching perceptualSpan) and the fast-phase
// emission stride: a point every 4 samples ≈ every 7ms of a 0.7s motion.
const SAMPLES = 400;
const FAST_PHASE_STRIDE = 4;

const format = (value: number) => {
  const rounded = +value.toFixed(5);
  return Object.is(rounded, -0) ? 0 : rounded;
};

// Engagement range: the governor only takes over a tail whose remaining
// travel is this short. A longer remainder is still ordinary motion.
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
    // motions are governed.
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
