import animateInline from "@transition/animateInline";
import { easingToCss, targetToDecls } from "@transition/compileTransitionStyles";
import { invertEasing } from "@transition/cubicBezier";
import { holdScrubAt, scrubTo } from "@transition/gestureScrub";
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
  /** The one the finger moves. Its time is written, never played. */
  readonly animation: Animation;
  /** The two motions a release can be, staged with it and held out of effect. */
  readonly commitLeg: Animation | null;
  readonly cancelLeg: Animation | null;
  readonly to: VariantMotion["to"];
  readonly clock: { start: number; duration: number; ease: VariantMotion["ease"] };
}

/**
 * A time before the active interval, where `fill: forwards` contributes
 * nothing. A leg parked here is staged, composited and inert; seeking it into
 * range is what makes it the motion on screen.
 */
const PARKED_MS = -1;

/**
 * The declared path, end for end: the same poses and the same stops, walked the
 * other way. Offsets mirror, so a stop a third of the way out is a stop two
 * thirds of the way home.
 */
const reversedFrames = (frames: readonly Keyframe[]): Keyframe[] =>
  [...frames]
    .map((frame, index) => ({
      ...frame,
      offset: typeof frame.offset === "number" ? 1 - frame.offset : index === 0 ? 1 : 0
    }))
    .reverse();

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
    // The poses this rider passes through, in order, with the end last. A
    // drag with stops is how two properties travel at different rates: one
    // reaches its value at the stop and holds, while another keeps going.
    // Only the stops carry an offset. The ends do not need one: WAAPI already
    // reads the first keyframe as 0 and the last as 1, and writing them would
    // change what every two-pose rider stages for no gain.
    const frames: Keyframe[] = [
      toKeyframe(motion.from),
      ...(motion.via ?? []).map((stop) => ({ ...toKeyframe(stop.value), offset: stop.at })),
      toKeyframe(motion.to)
    ];
    const animation = element.animate(frames, {
      duration: motion.duration * 1000,
      delay: motion.delay * 1000,
      easing: easingToCss(motion.ease),
      // `both`, so the pose holds before the travel and after it — the same
      // fill the compiled rule uses, and what keeps a scrubbed rider from
      // snapping back to its rest style between pointer moves.
      fill: "both"
    });

    // A RELEASE IS NOT THE DRAG PLAYED ON.
    //
    // The drag is position-controlled: the finger says where, and the scrub
    // seeks the animation to the time that pose sits at. A release is
    // time-controlled: a curve and a duration say where. Sharing one animation
    // between them makes the release inherit the drag's mapping, and then which
    // part of the authored curve it lands on is an accident of where the finger
    // stopped. A cancel always stops inside the curve's opening — device-
    // captured at 30ms of cupertino's 700 for a drag 9% across — and the
    // opening of any curve is its own tangent, so the return came home at a
    // dead constant speed with the author's deceleration still unreached at the
    // far end.
    //
    // So both motions a release can be are staged HERE, with the drag, and held
    // out of effect. The release only seeks and plays one; it never builds or
    // reshapes an effect, which is what kept the compositor from having to
    // commit an animation on the frame the finger lifts.
    //
    // The cancel's path is the declared one reversed, so playing it FORWARD is
    // the author's own motion arriving at the pose the drag began from. Both
    // legs carry the authored easing, and neither carries anything this file
    // invented: whatever a consumer declares, including its stops, is what the
    // release runs.
    const leg = (legFrames: Keyframe[]): Animation | null => {
      const created = element.animate(legFrames, {
        duration: motion.duration * 1000,
        easing: easingToCss(motion.ease),
        // Nothing before it is seeked into range; the landed pose after.
        fill: "forwards"
      });
      created.pause();
      try {
        created.currentTime = PARKED_MS;
      } catch {
        /* v8 ignore next 2 -- a host that refuses the seek leaves the leg
           unusable; the settle falls back to the drag animation below. */
        return null;
      }
      return created;
    };

    staged.push({
      element,
      animation,
      commitLeg: leg(frames),
      cancelLeg: leg(reversedFrames(frames)),
      to: motion.to,
      clock: { start: motion.delay, duration: motion.duration, ease: motion.ease }
    });
  }

  if (staged.length === 0) return null;
  for (const rider of staged) holdScrubAt([rider.animation], 0);

  let released = false;
  // Where the finger left each rider, as a fraction of its travel. The release
  // needs it to seek its leg to the pose already on screen; reading it back off
  // the animation would mean inverting the easing twice.
  let travelled = 0;
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
      travelled = progress < 0 ? 0 : progress > 1 ? 1 : progress;
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
        // Both legs run FORWARD, so the landing is the ordinary `finish` in
        // either direction. The reverse hook the scrub kept for a backwards
        // animation that fires no `animationend` is not needed here.
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
              rider.commitLeg?.cancel();
              rider.cancelLeg?.cancel();
              rider.element.removeAttribute(SKIP_ANIMATION_ATTR);
              resolve();
            };
            const landing = (commit ? rider.commitLeg : rider.cancelLeg) ?? rider.animation;
            landing.addEventListener("finish", land, { once: true });
            // The backstop the flight's own resolver keeps, for the same
            // reason: an animation torn down before it finishes fires nothing,
            // and a caller waiting on this must not wait for ever.
            if (typeof setTimeout === "function") {
              setTimeout(land, Math.max(seconds, 0) * 1000 + 60);
            }
          })
        );
        // SEEK THE LEG TO THE POSE ALREADY ON SCREEN, THEN LET IT RUN.
        //
        // The leg was staged with the drag, so the release writes nothing but a
        // time, a rate and a start. The cancel's frames are reversed, so the
        // pose the finger left sits at `1 - travelled` along it, and playing
        // forward walks the author's own motion home.
        const leg = commit ? rider.commitLeg : rider.cancelLeg;
        const onLeg = commit ? travelled : 1 - travelled;
        const durationMs = rider.clock.duration * 1000;
        const at = invertEasing(rider.clock.ease)(onLeg) * durationMs;
        const remaining = durationMs - at;
        if (!leg || remaining <= 0) {
          // Nothing left to fly, or a host that refused the staging: the drag
          // animation still holds the pose and the landing below lands it.
          rider.animation.pause();
        } else {
          // The rate is what makes the leg take the seconds the release settled
          // on: it covers what is left of its own clock in exactly that time.
          const rate = remaining / (Math.max(seconds, 1 / 60) * 1000);
          try {
            leg.currentTime = at;
            leg.playbackRate = rate;
            const timeline =
              typeof leg.timeline?.currentTime === "number" ? leg.timeline.currentTime : null;
            if (timeline === null) leg.play();
            else leg.startTime = timeline - at / rate;
          } catch {
            /* v8 ignore next -- an engine that refuses the placement still has
               the play below. */
            leg.play();
          }
        }
      }
      return Promise.all(landings).then(() => undefined);
    }
  };
};

export default beginRiderSwipe;
