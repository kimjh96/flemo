import type { AnimationOptions } from "@transition/cssTypes";

import { invertEasing } from "@transition/cubicBezier";

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
