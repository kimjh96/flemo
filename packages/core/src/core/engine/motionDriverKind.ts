import { resolveEasing } from "@transition/cubicBezier";
import type { Transition } from "@transition/typing";
import { type VariantMotion } from "@transition/variantMotion";

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

// The driver for one navigation of `transition` at `status`. An authored
// `driver` on the transition is the strongest routing input; the default is
// the PLAYER on every engine.
//
// - Blink: the compositor is the component that misses presentation
//   deadlines on raster-heavy layers (eye-verified single-variable A/B; the
//   reason the player exists), and rAF rides a healthy main thread.
// - Non-Blink (WebKit): the compiled clock is stamped at the frame TOP of
//   the rendering update that creates (or resumes) the animation, and
//   everything between that stamp and the glass — the update's own style/
//   layer work, the CA commit, the UI-process activation — runs on the
//   flight's clock. On a loaded phone that pipeline is 50-100ms+, and no
//   release scheduling can shrink it (an atomic rAF-flip closed the
//   task-injection window and the device still jumped "미세하게 나아진 것
//   뿐"): the opening of every cold flight starts visibly mid-curve. The
//   player is immune BY CONSTRUCTION — each presented frame shows the value
//   written that frame, and a block holds the capped clock instead of
//   aging it. This is also the only opening the device user ever judged
//   natural ("raf는 매우 자연스럽습니다", 2026-08 A/B). The player's known
//   trade — main-thread frame supply at the convergence — is now carried by
//   the early-armed arrival hold (mid-flight commits are display:none-held,
//   their layout cost gone), which the original convergence verdicts
//   predate. The untouched-native path remains for authored
//   `driver: "native"` pins (with the birth-window anchor and, for them,
//   the atomic release flip).
//
// The measured fast-mover carve-out (peak translation ≥
// NATIVE_PEAK_CSS_PX_PER_FRAME → native) stays retired as a default;
// peakTranslationPxPerFrame remains exported for diagnostics and pinned
// authors.
export const classifyTransitionDriver = (
  transition: Transition,
  // Kept for call-site and diagnostic stability: carve-outs read these.
  _status: string,
  _box: PerceptualBox
): MotionDriverKind => {
  const authored = (transition as { driver?: MotionDriverKind }).driver;
  if (authored === "native" || authored === "player") return authored;
  return "player";
};
