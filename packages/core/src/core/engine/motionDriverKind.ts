import { resolveEasing } from "@transition/cubicBezier";
import type { Transition, TransitionVariant } from "@transition/typing";
import { resolveVariantMotion, type VariantMotion } from "@transition/variantMotion";

import { channelValue, type PerceptualBox } from "./perceptualSpan";

// KIND-scoped motion-driver classification.
//
// On engines that present from the main thread (WebKit), neither driver wins
// everywhere — measured on device, side by side:
// - The rAF player's per-frame timing rides main-thread jitter, which reads
//   as a fine tremor on fast-moving screens (a pop's parallax), while its
//   re-anchoring clock keeps low-velocity fades smooth through the heavy
//   ungated mounts of a tab switch.
// - The native (compiled CSS) clock renders fast movers perfectly, but a tab
//   fade freezes with the blocked main thread and then jumps — the swallowed
//   opening.
// So the driver is chosen by WHAT THE AUTHORED MOTION IS, not by a preset
// name: a transition whose screens demonstrably MOVE fast runs on the native
// clock; everything else (fades, drifts, unanalyzable choreographies) keeps
// the player. The decision is a pure function of the authored keyframes and
// the screen box, so custom transitions classify exactly like presets, it is
// deterministic per transition, and it is consumed once per NAVIGATION (every
// participant of a navigation shares the transition and status), so a single
// navigation never splits across drivers.

// Peak translation at or above this runs on the native clock. The slide/fade
// boundary measured across this project's glass work: fast slides hide a
// one-frame timing wobble inside their own motion, sub-6px/frame motion does
// not.
export const NATIVE_PEAK_CSS_PX_PER_FRAME = 6;

const FRAME_MS = 1000 / 60;

// Peak per-frame translation (CSS px at 60Hz) of one motion, easing included;
// null when the translation cannot be reasoned about (unparseable endpoint,
// one-sided channel). Non-translation channels (opacity, filters, shadows)
// are ignored — they do not make a screen a fast mover — but a motion with NO
// analyzable translation at all is simply not a mover (0).
export const peakTranslationPxPerFrame = (
  motion: VariantMotion,
  box: PerceptualBox
): number | null => {
  let distance = 0;
  let sawTranslation = false;
  for (const key of ["x", "y"]) {
    const from = channelValue(motion.from, key, box);
    const to = channelValue(motion.to, key, box);
    if (from === undefined && to === undefined) continue;
    if (from === null || to === null || from === undefined || to === undefined) return null;
    sawTranslation = true;
    distance = Math.max(distance, Math.abs(to - from));
  }
  if (!sawTranslation || distance === 0) return 0;
  const durationMs = motion.duration * 1000;
  /* v8 ignore next 2 -- resolveVariantMotion never yields duration<=0 with a
     distance; kept so a hand-built motion cannot divide by zero. */
  if (durationMs <= 0) return 0;
  const frames = durationMs / FRAME_MS;
  const ease = resolveEasing(motion.ease);
  const steps = Math.max(1, Math.min(240, Math.ceil(frames)));
  let maxStep = 0;
  let previous = ease(0);
  for (let index = 1; index <= steps; index++) {
    const value = ease(index / steps);
    maxStep = Math.max(maxStep, Math.abs(value - previous));
    previous = value;
  }
  // maxStep is progress per (frames/steps) frames; normalize to one frame.
  return distance * maxStep * (steps / frames);
};

export type MotionDriverKind = "native" | "player";

// The driver for one navigation of `transition` at `status`, measured against
// the screen box. An authored `driver` on the transition overrides the
// measurement (the library provides the measured default; the author can
// always pin a borderline motion). An unanalyzable variant keeps the player —
// the conservative default that every motion ran on before this
// classification existed.
export const classifyTransitionDriver = (
  transition: Transition,
  status: string,
  box: PerceptualBox
): MotionDriverKind => {
  const authored = (transition as { driver?: MotionDriverKind }).driver;
  if (authored === "native" || authored === "player") return authored;
  let peak = 0;
  for (const active of ["true", "false"]) {
    const motion = resolveVariantMotion(transition, `${status}-${active}` as TransitionVariant);
    if (!motion) continue;
    const variantPeak = peakTranslationPxPerFrame(motion, box);
    if (variantPeak === null) return "player";
    peak = Math.max(peak, variantPeak);
  }
  return peak >= NATIVE_PEAK_CSS_PX_PER_FRAME ? "native" : "player";
};
