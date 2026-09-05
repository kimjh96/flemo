import { ANIM_HOLD_ATTR, FLEMO_ANIMATION_PREFIX, HOLD_VALUES } from "./domProtocol";

import type { MotionProgress } from "./types";

// THE FRAME PROBE: did frames arrive, and did the picture change.
//
// Two questions, deliberately separate. Frame gaps answer the first; the pose
// and clock readings answer the second. Keeping them apart is not tidiness —
// the 2026-08-18 release race paused running flights for ~250ms while rAF
// ticked at a perfect 16.7ms throughout, so an instrument that only measures
// arrival calls that flight clean.
//
// Everything here reads state that is already computed: an animation's own
// `currentTime` (no style flush) and the inline style attribute (already
// parsed). The probe must never become the cost it is measuring.

/**
 * A released frame counts as stalled only once the flight has moved at least
 * once — the first released frame has nothing to compare against, and a
 * compiled animation's clock legitimately reads 0 on it.
 */
const STALL_MIN_FRAMES = 2;

const HOLD_KINDS = new Set<string>(HOLD_VALUES);

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Driver evidence gathered by the rAF sampler during a flight. */
export interface DriverEvidence {
  /** A running CSSAnimation named flemo-* was observed on a participant. */
  compiledAnimation: boolean;
  /** A participant carried inline `animation` suppression. */
  inlineSuppression: boolean;
  /** Inline transform/opacity advanced between sampled frames. */
  inlineAdvance: boolean;
}

/** Everything the frame probe accumulates for one flight. */
export interface FrameProbeState {
  /** Frame gaps while any participant still carried an active anim-hold. */
  heldGaps: number[];
  /** Frame gaps after every hold released (the visible-motion phase). */
  releasedGaps: number[];
  lastFrameAt: number | null;
  evidence: DriverEvidence;
  lastPose: Map<Element, string>;
  /** Cached compiled animations, so the clock read never re-queries per frame. */
  clocks: Map<Element, Animation>;
  lastClock: Map<Element, number>;
  releasedFrames: number;
  stalledFrames: number;
  tailFrames: number;
  stallRunMs: number;
  longestStallMs: number;
  pausedAfterRelease: boolean;
  holdReassertedAtMs: number | null;
}

export const createFrameProbeState = (): FrameProbeState => ({
  heldGaps: [],
  releasedGaps: [],
  lastFrameAt: null,
  evidence: { compiledAnimation: false, inlineSuppression: false, inlineAdvance: false },
  lastPose: new Map(),
  clocks: new Map(),
  lastClock: new Map(),
  releasedFrames: 0,
  stalledFrames: 0,
  tailFrames: 0,
  stallRunMs: 0,
  longestStallMs: 0,
  pausedAfterRelease: false,
  holdReassertedAtMs: null
});

/**
 * A hold is active while ANY participating element still carries an active
 * `data-flemo-anim-hold` value; the flight is "released" once every one of
 * them reads "false" (or drops the attribute). The engine deliberately absorbs
 * heavy commits INTO the hold — the screen is posed, not moving — so gaps and
 * long tasks are segmented on this boundary.
 */
export const holdActive = (elements: readonly Element[]): boolean =>
  elements.some((element) => {
    const value = element.getAttribute(ANIM_HOLD_ATTR);
    return value !== null && HOLD_KINDS.has(value);
  });

const poseOf = (style: CSSStyleDeclaration): string => `${style.transform}/${style.opacity}`;

/**
 * Did this frame MOVE? Read from the cheapest honest source per tier: a
 * compiled flight's own animation clock (getAnimations, no style flush) and an
 * inline-driven flight's pose (already in the style attribute). A frame where
 * neither moved is a stall — the signature that timing metrics miss.
 */
export const sampleProgress = (
  state: FrameProbeState,
  elements: readonly Element[],
  frameGapMs: number
): void => {
  state.releasedFrames += 1;
  let advanced = false;
  // A frame after the last animation has FINISHED is not a stall: the motion
  // is over and the pose is meant to be still. Only the flight's own closing
  // latency is left, which is a different measurement (see tailFrames).
  let anyRunningClock = false;
  for (const element of elements) {
    const clock = state.clocks.get(element);
    if (clock) {
      if (clock.playState === "paused") state.pausedAfterRelease = true;
      if (clock.playState !== "finished") anyRunningClock = true;
      const time = typeof clock.currentTime === "number" ? clock.currentTime : null;
      if (time !== null) {
        const previous = state.lastClock.get(element);
        if (previous !== undefined && time !== previous) advanced = true;
        state.lastClock.set(element, time);
      }
    }
    const style = (element as HTMLElement).style;
    if (style && style.animation !== "") {
      if (state.lastPose.get(element) !== poseOf(style)) advanced = true;
    }
  }
  // Nothing to compare against on the first released frame.
  if (state.releasedFrames < STALL_MIN_FRAMES) return;
  if (advanced) {
    state.stallRunMs = 0;
    return;
  }
  if (!anyRunningClock && state.clocks.size > 0) {
    state.tailFrames += 1;
    state.stallRunMs = 0;
    return;
  }
  state.stalledFrames += 1;
  state.stallRunMs += frameGapMs;
  if (state.stallRunMs > state.longestStallMs) state.longestStallMs = state.stallRunMs;
};

const readInlineEvidence = (state: FrameProbeState, element: Element): void => {
  const style = (element as HTMLElement).style;
  if (!style || style.animation === "") return;
  state.evidence.inlineSuppression = true;
  const pose = poseOf(style);
  const previous = state.lastPose.get(element);
  if (previous !== undefined && previous !== pose) state.evidence.inlineAdvance = true;
  state.lastPose.set(element, pose);
};

export const sampleDriverEvidence = (
  state: FrameProbeState,
  elements: readonly Element[]
): void => {
  for (const element of elements) {
    const getAnimations = (element as Element & { getAnimations?: () => Animation[] })
      .getAnimations;
    const cached = state.clocks.get(element);
    // getAnimations() allocates an array per call; once this element's
    // compiled animation is in hand, re-reading it every frame is pure
    // overhead on the very thread the flight is competing for.
    if (cached !== undefined && cached.playState !== "finished") {
      // The cached animation still counts as evidence: it is usually CACHED
      // WHILE PAUSED (the hold poses the screen before releasing it), so
      // skipping this would classify a perfectly normal compiled flight as
      // "unknown" the moment it starts running.
      if (cached.playState === "running") state.evidence.compiledAnimation = true;
      readInlineEvidence(state, element);
      continue;
    }
    if (typeof getAnimations === "function") {
      try {
        for (const animation of getAnimations.call(element)) {
          const name = (animation as { animationName?: string }).animationName;
          if (typeof name === "string" && name.startsWith(FLEMO_ANIMATION_PREFIX)) {
            // Cached for the per-frame clock read; re-queried only while the
            // element has no live animation yet.
            state.clocks.set(element, animation);
            if (animation.playState === "running") state.evidence.compiledAnimation = true;
          }
        }
      } catch {
        // getAnimations can throw on detached nodes in some engines.
      }
    }
    readInlineEvidence(state, element);
  }
};

/**
 * Everything the frame probe knows about the motion. `firstAnimationAtMs` is
 * deliberately NOT here: it comes from the browser's own `animationstart`
 * event, which is a tripwire, and the orchestrator joins the two.
 */
export const motionProgress = (
  state: FrameProbeState
): Omit<MotionProgress, "firstAnimationAtMs"> => ({
  sampledFrames: state.releasedFrames,
  stalledFrames: state.stalledFrames,
  longestStallMs: round1(state.longestStallMs),
  pausedAfterRelease: state.pausedAfterRelease,
  holdReassertedAtMs: state.holdReassertedAtMs,
  tailFrames: state.tailFrames
});
