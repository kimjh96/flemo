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
  const now = ((animations[0]?.currentTime as number | null) ?? 0) / 1000;
  const total = clock.start + clock.duration;
  const remaining = commit ? Math.max(total - now, 0) : Math.max(now, 0);
  const rate = remaining > 0 ? remaining / span : 1;

  for (const animation of animations) {
    // `play()` on a FINISHED animation rewinds it. That is the spec — an
    // exhausted animation replays from its start — and it is wrong for every
    // passenger of a flight already done with its own span: a 17ms cut that
    // finished before the finger let go replayed, and the element that had
    // been cut came back opaque for a frame before cutting again. Its time is
    // kept and put back after the play.
    const at = animation.currentTime;
    animation.playbackRate = commit ? rate : -rate;
    if (!commit && onReverseFinish) {
      animation.addEventListener("finish", onReverseFinish, { once: true });
    }
    animation.play();
    try {
      animation.currentTime = at;
    } catch {
      // A timeline that refuses the seek leaves the play as it landed.
    }
  }
};
