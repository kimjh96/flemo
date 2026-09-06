import animateInline from "@transition/animateInline";
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
  /**
   * Whether any element this staged has left the document.
   *
   * A gesture stages against the elements that exist when it begins, and a
   * drag's own wake can REPLACE one of them a frame later — a covered screen's
   * dim moves between its container and the layer host as that screen's
   * `<Layer>` slots unmount and re-mount (see resolvePrevDecorator in
   * createSwipeController). The animations stay on the node that left, so the
   * one on screen never moves. Reported for the hook-driven dim; the same wake
   * reaches a pose-only one, which is what this is for.
   */
  readonly stale: boolean;
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
   *
   * RESOLVES WHEN THE LANDING HAS LANDED. A caller that commits a navigation
   * off the back of a release has to wait for it: the screens are staged
   * animations now, so committing while they still play removes the screen
   * mid-flight and it vanishes rather than leaving. Device-reported the first
   * time the declarative path shipped without this.
   */
  settle: (commit: boolean, seconds: number) => Promise<void>;
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
  readonly to: VariantMotion["to"];
  readonly clock: { start: number; duration: number; ease: VariantMotion["ease"] };
}

/**
 * Stage the riders of a drag, paused at zero. Returns null when there is
 * nothing to drive, so a gesture over chrome that declares no motion costs
 * nothing.
 */
export const beginRiderSwipe = (
  riders: readonly RiderMotion[],
  options: {
    /**
     * The writer staking the landed pose this hands back (see the note in
     * `settle`). A caller whose own cleanup is owner-scoped — the swipe's
     * riding bars are — has to be the one on the lease, or its clear will not
     * release what was written here.
     */
    writer?: symbol;
  } = {}
): RiderSwipe | null => {
  const { writer } = options;
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
      to: motion.to,
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
    get stale() {
      return staged.some((rider) => !rider.element.isConnected);
    },
    scrub: (progress: number) => {
      if (released) return;
      // Per rider, because a part and the dim need not share a clock: each
      // inherits its own from the same screen variant, and an author may have
      // written a longer one on either.
      for (const rider of staged) scrubTo([rider.animation], rider.clock, progress);
    },
    settle: (commit: boolean, seconds: number) => {
      if (released) return Promise.resolve();
      released = true;
      const landings: Promise<void>[] = [];
      for (const rider of staged) {
        if (commit) rider.element.setAttribute(SKIP_ANIMATION_ATTR, "true");
        // BOTH DIRECTIONS HAND THE ELEMENT BACK.
        //
        // A staged animation carries `fill: both`, so one left behind holds its
        // end pose for good — and a gesture-driven rider is not a throwaway
        // like the departing screen's parts: the screen a swipe RETURNS to
        // survives, and its parts then wore the finished pose into the next
        // flight, where they fought the compiled rule that was supposed to move
        // them. Reported as the previous element overlapping and then vanishing
        // on the next push, and as a pop that would not run its whole way.
        //
        // `settleScrubbed`'s own reverse hook cannot do this: it exists because
        // a backwards animation fires no `animationend`, and the morph that
        // taught it that still wants forward landings left to the engine. This
        // one listens for the Animation's own `finish`, which both directions
        // do fire.
        landings.push(
          new Promise<void>((resolve) => {
            let done = false;
            const land = () => {
              if (done) return;
              done = true;
              if (commit) {
                // GIVE THE LANDED POSE A BASIS THAT IS NOT THE ANIMATION,
                // before letting the animation go.
                //
                // Cancelling returns an element to its own REST style, and on a
                // committed swipe that style is not where the gesture left it:
                // the screen that flew out rests where it started, and the
                // screen that came home rests at the parallax the pop was
                // supposed to take it out of. Both blinked — measured on the
                // bench as the returning screen dropping to -117px for two
                // frames before the stack re-rendered it as the active one.
                //
                // Holding the animation's own fill instead was tried first and
                // WebKit did not honour it. An inline write does, and it is
                // what this path left behind before the drag became an
                // animation; the flight's COMPLETED cleanup strips it.
                void animateInline(rider.element, rider.to, { duration: 0 }, writer);
              }
              rider.animation.cancel();
              rider.element.removeAttribute(SKIP_ANIMATION_ATTR);
              resolve();
            };
            rider.animation.addEventListener("finish", land, { once: true });
            // The backstop the flight's own resolver keeps, for the same
            // reason: an animation torn down before it finishes fires nothing,
            // and a caller waiting on this must not wait for ever.
            if (typeof setTimeout === "function") {
              setTimeout(land, Math.max(seconds, 0) * 1000 + 60);
            }
          })
        );
        settleScrubbed([rider.animation], rider.clock, commit, seconds);
      }
      return Promise.all(landings).then(() => undefined);
    }
  };
};

export default beginRiderSwipe;
