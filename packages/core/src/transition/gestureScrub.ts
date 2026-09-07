import type { AnimationOptions } from "@transition/cssTypes";

import { invertEasing, resolveEasing } from "@transition/cubicBezier";

// A FLIGHT THE FINGER OWNS.
//
// Every other flight in flemo is clocked by the compiled hold: the engine
// pauses the animations, flips one attribute, and the browser runs them. A drag
// has neither half of that. The navigation does not exist yet — a swipe commits
// on release, if at all — so there is no status to stage from and no hold
// attribute to mirror.
//
// So the gesture stages the animations itself, holds them at zero, and moves
// them by hand. It runs NO frame loop: the animations are the browser's own,
// and the pointer event sets their time. On release they are handed back —
// played forward to commit, or backwards to put things where they started.
//
// The rules below were learned once, on glass, driving a morph. They are here
// rather than in @morph because a `<Part>` and a decorator now ride the same
// gesture, and a second copy of this arithmetic is how the two would drift.

/**
 * Milliseconds off an animation or a timeline, or null when it has none yet.
 *
 * `currentTime` and `startTime` are `CSSNumberish`: a plain number on every
 * engine that ships this, and a `CSSNumericValue` under the scroll-timeline
 * proposals. Both are read here.
 */
const timeOf = (holder: { currentTime: CSSNumberish | null } | null): number | null => {
  const time = holder?.currentTime ?? null;
  if (time === null) return null;
  if (typeof time === "number") return time;
  // `CSSUnitValue` carries the number; the wider `CSSNumericValue` it is typed
  // as does not, and a sum or a product has no single one to read.
  const unit = time as { value?: unknown };
  return typeof unit.value === "number" ? unit.value : null;
};

export interface ScrubClock {
  /** Seconds from the animation's zero to the first frame of travel. */
  readonly start: number;
  readonly duration: number;
  readonly ease: AnimationOptions["ease"];
}

/**
 * Put every animation at one time and keep it there.
 *
 * Paused first: an animation the browser is still running would otherwise
 * advance between the seek and the next pointer move.
 */
export const holdScrubAt = (animations: readonly Animation[], seconds: number): void => {
  for (const animation of animations) {
    animation.pause();
    try {
      animation.currentTime = seconds * 1000;
    } catch {
      // An animation with no resolved timeline yet refuses the seek. It will
      // be seeked again on the next pointer move, which is 16ms away.
    }
  }
};

/**
 * Move to a fraction of the TRAVEL, not of the clock.
 *
 * Those are the same number only for a linear ease; under the built-in curve a
 * finger a tenth of the way across moves the element a fiftieth, and the
 * release is left to rush the rest.
 */
export const scrubTo = (
  animations: readonly Animation[],
  clock: ScrubClock,
  progress: number
): void => {
  const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  holdScrubAt(animations, clock.start + invertEasing(clock.ease)(clamped) * clock.duration);
};

/**
 * Hand the animations back to the browser at the speed the release settled at.
 *
 * `commit` plays them out to the arrival — the gesture became a navigation.
 * Otherwise they run BACKWARDS to where they started.
 *
 * `onReverseFinish` exists because backwards an animation finishes at its start
 * and fires no `animationend`. Anything listening for one has to be told
 * explicitly instead.
 */
export const settleScrubbed = (
  animations: readonly Animation[],
  clock: ScrubClock,
  commit: boolean,
  seconds: number,
  onReverseFinish?: () => void
): void => {
  const span = Math.max(seconds, 1 / 60);
  // The remaining travel decides the RATE, so a release near either end lands
  // as quickly as the screens do rather than replaying a whole flight's worth
  // of clock.
  const now = (timeOf(animations[0] ?? null) ?? 0) / 1000;
  const total = clock.start + clock.duration;
  const remaining = commit ? Math.max(total - now, 0) : Math.max(now, 0);
  const rate = remaining > 0 ? remaining / span : 1;

  for (const animation of animations) {
    const at = timeOf(animation) ?? 0;
    const playbackRate = commit ? rate : -rate;
    animation.playbackRate = playbackRate;
    if (!commit && onReverseFinish) {
      animation.addEventListener("finish", onReverseFinish, { once: true });
    }

    // THE RELEASE PLACES THE ANIMATION, IT DOES NOT `play()` IT.
    //
    // `play()` does not resume a held animation where it was held. It clears
    // the hold and leaves the animation play-PENDING, with the start time the
    // NEXT frame resolves deciding what time it lands on — and the two engines
    // resolve it differently. Blink starts the clock at the release, which is
    // what the gesture means. WebKit resolves it against the animation's own
    // origin, so a flight the finger held for a second comes back a second in:
    // `currentTime` jumps the whole drag's worth of clock in one frame, the
    // element stops tracking what the clock says, and the flight is torn down
    // by its own end a moment later. On glass that is a shared element frozen
    // at the pose the finger let go of while the screens slide out from under
    // it, and then gone. Measured on iOS Safari and reproduced in WebKit.
    //
    // A start time written by hand has no pending frame to disagree about:
    // `currentTime` is `(timeline - start) * rate` by definition, so solving it
    // for the time the gesture held puts the animation exactly there, running,
    // in both engines. It also runs FORWARD from a finished passenger rather
    // than rewinding it, which `play()` does not — a 17ms cut that finished
    // before the release used to replay, and the element that had been cut came
    // back opaque for a frame before cutting again.
    const timeline = timeOf(animation.timeline);
    if (timeline === null) {
      // No resolved timeline to solve against (a document not yet presented).
      // The play is the only way to hand it back, and its pending frame is
      // whatever the engine decides.
      animation.play();
      continue;
    }
    try {
      animation.startTime = timeline - at / playbackRate;
    } catch {
      // A timeline that refuses the write leaves the animation where it is;
      // the flight's own backstop still brings the element home.
      animation.play();
    }
  }
};

// A RELEASE IS NOT THE DRAG PLAYED BACKWARDS.
//
// The drag is position-controlled: the finger says where, and the scrub seeks
// the animation to the time that pose sits at. A cancel handed back with a
// negative rate replays that seek in reverse — and because the scrub inverts
// the curve, a drag a tenth of the way across sits inside the curve's OPENING.
// The opening of any curve is its own tangent, so the return came home at a
// dead constant speed with the author's deceleration still unreached at the far
// end. Device-captured at 30ms of cupertino's 700 for a drag 9% across.
//
// A `<Part>` and a decorator stage their two legs from what the author
// declared (see riderSwipe). A morph cannot: its motion is a compiled
// `@keyframes` on the element, so the declaration this needs is only readable
// back off the animation itself. What follows reads it there, and stages the
// same leg from it.

/**
 * A time before the active interval, where `fill: forwards` contributes
 * nothing. A leg parked here is staged, composited and inert; seeking it into
 * range is what makes it the motion on screen.
 */
export const PARKED_MS = -1;

const CSS_EASES: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1]
};

/**
 * A computed `easing` string, back as the curve this package works in.
 *
 * `null` for anything with no speed to read — a step, a spring, `linear()` —
 * which is what keeps those channels off the leg below.
 */
const cssEase = (value: string | undefined): AnimationOptions["ease"] | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed === "linear") return "linear";
  const named = CSS_EASES[trimmed];
  if (named) return [...named];
  const bezier = /^cubic-bezier\(([^)]+)\)$/.exec(trimmed);
  if (!bezier) return null;
  const points = bezier[1]!.split(",").map((part) => Number.parseFloat(part));
  if (points.length !== 4 || points.some((point) => !Number.isFinite(point))) return null;
  return points as [number, number, number, number];
};

type Pose = Record<string, string | number | null | undefined>;

export interface DeclaredFrame {
  /** Where along the animation's own clock this pose sits, 0 to 1. */
  readonly offset: number;
  /** The curve carried by the segment that LEAVES this frame. */
  readonly easing: string;
  readonly pose: Pose;
}

/**
 * CSS property names as a keyframe wants them: IDL for the standard ones, and
 * a custom property left exactly as it was written.
 */
const idlName = (property: string): string =>
  property.startsWith("--")
    ? property
    : property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

/** The property values of a computed keyframe, without its timing members. */
const poseOf = (frame: ComputedKeyframe): Pose => {
  const pose: Pose = {};
  for (const [key, value] of Object.entries(frame)) {
    if (key === "composite" || key === "computedOffset" || key === "easing" || key === "offset") {
      continue;
    }
    pose[key] = value as string | number | null | undefined;
  }
  return pose;
};

export interface ReturnLeg {
  /** Staged with the drag, parked out of effect until the release seeks it. */
  readonly animation: Animation;
  /** The leg's own clock, in milliseconds: its zero is the flight's arrival. */
  readonly duration: number;
  /** The stretch of that clock the poses actually travel over. */
  readonly travel: { readonly start: number; readonly end: number };
  /** The curve that stretch carries, which the release inverts to seek by pose. */
  readonly ease: AnimationOptions["ease"];
  /** The same stretch on the SOURCE's clock, for reading where the finger left it. */
  readonly source: { readonly start: number; readonly end: number; readonly delay: number };
}

/**
 * Stage the return of a running animation: its own path, walked the other way.
 *
 * The poses come back off the animation, so whatever a consumer declared —
 * including its stops — is what the return runs. Offsets mirror, so a stop a
 * third of the way out is a stop two thirds of the way home, and each segment
 * keeps the curve it was given, pointing FORWARD: reversing a path must not
 * reverse its speed, or the return would leave slowly and arrive at full tilt.
 *
 * The flat lead-in a flight spends before it moves is dropped from the end of
 * the leg, so the leg finishes when the travel does rather than holding the
 * landed pose for the length of a head nobody is waiting through.
 *
 * `declared` is the path as its author wrote it, for a caller that can read it
 * back — a compiled animation must pass one, because what an engine reports
 * through `getKeyframes` is not always all of it: Chromium answers a CSS
 * animation with the offsets and the curves and NONE of the custom properties,
 * and a morph's whole box travels through registered custom properties. The
 * animation's own keyframes are the fallback, and enough for anything staged
 * through `element.animate`.
 *
 * `null` when there is nothing faithful to stage — a stepped channel, which is
 * a handover rather than a motion; a host that drops a property the source
 * animates; an animation that never moves. Those are handed back the way they
 * always were, by playing them backwards.
 */
export const stageReturnLeg = (
  source: Animation,
  declared?: readonly DeclaredFrame[] | null
): ReturnLeg | null => {
  const effect = source.effect as KeyframeEffect | null;
  if (!effect || typeof effect.getKeyframes !== "function") return null;
  if (typeof effect.getTiming !== "function") return null;
  const target = effect.target as HTMLElement | null;
  if (!target || effect.pseudoElement) return null;
  if (typeof target.animate !== "function") return null;

  const timing = effect.getTiming();
  const duration = typeof timing.duration === "number" ? timing.duration : 0;
  if (!(duration > 0)) return null;
  const frames: readonly DeclaredFrame[] =
    declared ??
    effect.getKeyframes().map((frame) => ({
      offset: frame.computedOffset,
      easing: frame.easing,
      pose: poseOf(frame)
    }));
  if (frames.length < 2) return null;
  // A step is a handover, not a travel: it says WHO renders the element, and
  // the flight's own landing is what hands it back. Reversed as a motion it
  // would fire at the top of the return instead, showing the element that was
  // cut alongside the one still flying home.
  if (frames.some((frame) => String(frame.easing).includes("step"))) return null;

  const poses = frames.map((frame) => frame.pose);
  const keys = Object.keys(poses[0]!);
  if (keys.length === 0) return null;
  // A pose that declares different properties from its neighbour cannot be
  // paired with one across the reversal without inventing a value for the
  // difference.
  const declaresAll = (pose: Pose) =>
    Object.keys(pose).length === keys.length && keys.every((key) => key in pose);
  if (!poses.every(declaresAll)) return null;
  // Every pose declares the same properties by the line above, so a pose is
  // another one's twin when those properties all match.
  const samePose = (left: Pose, right: Pose) => keys.every((key) => left[key] === right[key]);

  const offsets = frames.map((frame) => frame.offset);
  const easings = frames.map((frame) => frame.easing);
  const last = frames.length - 1;
  // What travels, and what is only a hold at either end: a flight's flat
  // lead-in and the frame it spends arrived are poses repeated, so the travel
  // is what lies between the last frame equal to the first and the first frame
  // equal to the last.
  let head = 0;
  while (head < last && samePose(poses[head + 1]!, poses[0]!)) head++;
  let tail = last;
  while (tail > 0 && samePose(poses[tail - 1]!, poses[last]!)) tail--;
  if (tail <= head) return null;
  const ease = cssEase(easings[head]);
  if (ease === null) return null;

  const sourceStart = offsets[head]! * duration;
  const sourceEnd = offsets[tail]! * duration;
  // The head cannot run to the end: a travel exists, so the pose it starts
  // from is not the pose it holds at 100%.
  const legDuration = duration - sourceStart;

  const legFrames: Keyframe[] = [];
  for (let index = last; index >= head; index--) {
    const frame: Keyframe = {
      // The last frame is the pose the flight started from, and it lands
      // exactly on the leg's end rather than a rounding step short of it.
      offset: index === head ? 1 : Math.min(1, ((1 - offsets[index]!) * duration) / legDuration),
      // The segment this frame now LEAVES is the one the source entered it
      // through, so its curve comes along with it.
      easing: easings[Math.max(head, index - 1)]
    };
    const pose = poses[index]!;
    for (const key of keys) frame[idlName(key)] = pose[key];
    legFrames.push(frame);
  }

  const leg = target.animate(legFrames, {
    duration: legDuration,
    easing: typeof timing.easing === "string" ? timing.easing : "linear",
    // Nothing before it is seeked into range; the landed pose after.
    fill: "forwards"
  });
  leg.pause();
  try {
    leg.currentTime = PARKED_MS;
  } catch {
    // A host that refuses the seek cannot park the leg out of effect, and a
    // leg left in effect would wear the flight's arrival for the whole drag.
    leg.cancel();
    return null;
  }
  // A HOST THAT TOOK THE KEYFRAMES BUT NOT THE PROPERTIES stages a leg that
  // animates nothing, and a cancel would leave the element hanging in the air.
  // Registered custom properties are the ones at stake — a morph's whole pose
  // travels through them — so the leg is asked what it actually took.
  const stagedKeys = new Set(
    (leg.effect as KeyframeEffect | null)
      ?.getKeyframes?.()
      .flatMap((frame) => Object.keys(frame)) ?? keys
  );
  if (!keys.every((key) => stagedKeys.has(idlName(key)))) {
    leg.cancel();
    return null;
  }

  return {
    animation: leg,
    duration: legDuration,
    travel: { start: duration - sourceEnd, end: legDuration },
    ease,
    source: {
      start: sourceStart,
      end: sourceEnd,
      delay: typeof timing.delay === "number" ? timing.delay : 0
    }
  };
};

/**
 * Where on the leg the pose already on screen sits, and what is left of it.
 *
 * The leg's path is the source's reversed, so the pose the finger left at a
 * fraction `q` of the travel sits at `1 - q` along it — through the curve,
 * which is why this inverts rather than mirrors the time.
 *
 * `null` when there is nothing left to fly.
 */
export const returnLegSeek = (
  leg: ReturnLeg,
  source: Animation
): { at: number; remaining: number } | null => {
  const width = leg.source.end - leg.source.start;
  /* v8 ignore next -- staging refuses a zero-width travel. */
  if (width <= 0) return null;
  const local = (timeOf(source) ?? 0) - leg.source.delay;
  const raw = (local - leg.source.start) / width;
  const walked = resolveEasing(leg.ease)(raw < 0 ? 0 : raw > 1 ? 1 : raw);
  const at =
    leg.travel.start + invertEasing(leg.ease)(1 - walked) * (leg.travel.end - leg.travel.start);
  const remaining = leg.duration - at;
  return remaining > 0 ? { at, remaining } : null;
};

/**
 * Put a staged leg at the pose already on screen and let it run.
 *
 * `remaining` of the leg's own clock covers the release's `seconds`, which is
 * what makes a leg staged for the flight's length land in the time the release
 * settled on. Nothing here builds or reshapes an effect — the leg was staged
 * with the drag — so the frame the finger lifts has no animation to commit.
 */
export const placeLeg = (leg: Animation, at: number, remaining: number, seconds: number): void => {
  const rate = remaining / (Math.max(seconds, 1 / 60) * 1000);
  try {
    leg.currentTime = at;
    leg.playbackRate = rate;
    // The same start time the hand-back above writes by hand, and for the same
    // reason: a `play()` leaves the leg pending on a frame the two engines
    // resolve differently.
    const timeline = timeOf(leg.timeline);
    if (timeline === null) leg.play();
    else leg.startTime = timeline - at / rate;
  } catch {
    /* v8 ignore next 2 -- an engine that refuses the placement still has the
       play. */
    leg.play();
  }
};
