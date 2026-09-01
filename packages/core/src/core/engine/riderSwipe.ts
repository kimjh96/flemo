import { easingToCss, targetToDecls } from "@transition/compileTransitionStyles";
import { holdScrubAt, scrubTo, settleScrubbed } from "@transition/gestureScrub";
import type { VariantMotion } from "@transition/variantMotion";

import { SKIP_ANIMATION_ATTR } from "@dom/attributes";

// WHAT RIDES A FLIGHT FOLLOWS THE FINGER.
//
// A `<Part>` and a decorator declare a pose for each side of a hand-over, and a
// compiled `@keyframes` plays it whenever the engine flips a status. A DRAG
// flips nothing: `isReadyForDrag` requires COMPLETED and the navigation only
// begins at `back()`, so those rules never match and the chrome sat still while
// the screens moved under the finger.
//
// The morph solved this first, and this is its model: the gesture stages the
// animations itself, holds them at zero, and moves them by hand. It runs no
// frame loop — the animations are the browser's own and the pointer event sets
// their time (see @transition/gestureScrub for the rules that carries).
//
// WHY IT STAGES ITS OWN rather than borrowing the compiled rule: making the
// compiled one match would mean writing POPPING onto the element mid-drag, and
// the status attribute is the engine's account of what is actually happening.
// A gesture that has not navigated must not claim it has.
//
// An author who writes `onSwipe*` on the part or decorator still owns it. This
// is the default for the ones who wrote only a pose, which until now got
// nothing.

export interface RiderSwipe {
  /** Whether anything is actually being driven. */
  readonly active: boolean;
  /** Move every rider to this fraction of its travel (0 → 1). */
  scrub: (progress: number) => void;
  /**
   * Hand the riders back at the speed the release settled at.
   *
   * `commit` plays them out to the arrival and marks each element so the
   * navigation's own compiled keyframe does not replay it from its `from`
   * pose — the contract the swipe already applies to the screen and the dim.
   * Otherwise they run backwards and the compiled rest rule takes them over
   * again.
   */
  settle: (commit: boolean, seconds: number) => void;
}

export interface RiderMotion {
  readonly element: HTMLElement;
  readonly motion: VariantMotion;
}

// WAAPI keyframes want IDL names; the compiler emits CSS ones because that is
// what a stylesheet takes. One conversion, rather than a second declaration
// builder that could describe a pose differently from the compiled rule.
const toKeyframe = (target: VariantMotion["from"]): Keyframe => {
  const frame: Keyframe = {};
  for (const decl of targetToDecls(target)) {
    const idl = decl.property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    frame[idl] = decl.value;
  }
  return frame;
};

interface StagedRider {
  readonly element: HTMLElement;
  readonly animation: Animation;
  readonly clock: { start: number; duration: number; ease: VariantMotion["ease"] };
}

/**
 * Stage the riders of a drag, paused at zero. Returns null when there is
 * nothing to drive, so a gesture over chrome that declares no motion costs
 * nothing.
 */
export const beginRiderSwipe = (riders: readonly RiderMotion[]): RiderSwipe | null => {
  const staged: StagedRider[] = [];

  for (const { element, motion } of riders) {
    if (motion.duration <= 0) continue;
    /* v8 ignore next -- jsdom implements Element.animate; the guard is for a
       host that does not, where a drag simply moves nothing. */
    if (typeof element.animate !== "function") continue;
    const animation = element.animate([toKeyframe(motion.from), toKeyframe(motion.to)], {
      duration: motion.duration * 1000,
      delay: motion.delay * 1000,
      easing: easingToCss(motion.ease),
      // `both`, so the pose holds before the travel and after it — the same
      // fill the compiled rule uses, and what keeps a scrubbed rider from
      // snapping back to its rest style between pointer moves.
      fill: "both"
    });
    staged.push({
      element,
      animation,
      clock: { start: motion.delay, duration: motion.duration, ease: motion.ease }
    });
  }

  if (staged.length === 0) return null;
  for (const rider of staged) holdScrubAt([rider.animation], 0);

  let released = false;
  return {
    get active() {
      return !released;
    },
    scrub: (progress: number) => {
      if (released) return;
      // Per rider, because a part and the dim need not share a clock: each
      // inherits its own from the same screen variant, and an author may have
      // written a longer one on either.
      for (const rider of staged) scrubTo([rider.animation], rider.clock, progress);
    },
    settle: (commit: boolean, seconds: number) => {
      if (released) return;
      released = true;
      for (const rider of staged) {
        if (commit) rider.element.setAttribute(SKIP_ANIMATION_ATTR, "true");
        settleScrubbed([rider.animation], rider.clock, commit, seconds, () => {
          // Backwards, the gesture is undone: drop the staged animation so the
          // element's own rest rule owns it again. Forward, the pose it lands
          // on IS the rest pose the navigation resolves to, so it is left in
          // place and the engine's COMPLETED cleanup takes it.
          rider.animation.cancel();
        });
      }
    }
  };
};

export default beginRiderSwipe;
