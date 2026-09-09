import animateInline from "@transition/animateInline";
import { easingToCss, targetToDecls } from "@transition/compileTransitionStyles";
import { invertEasing, resolveEasing } from "@transition/cubicBezier";
import { holdScrubAt, PARKED_MS, placeLeg, scrubToTime } from "@transition/gestureScrub";
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
  /**
   * Move every rider to where this fraction of the gesture (0 → 1) puts it.
   *
   * A pair moves the two sides of the drag apart, for a transition whose own
   * `progress` reports them apart; one number is both sides.
   */
  scrub: (progress: number | { current: number; prev: number }) => void;
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
  /**
   * The screen this rider is chrome ON, where it is chrome on one.
   *
   * A SCREEN IS ITS OWN PHASE, so it omits this and nothing changes for it.
   * Everything riding a screen names it, and that is what keeps a drag and the
   * flight it walks reading as the same motion. See `scrub`.
   */
  readonly phase?: {
    /** Which of a drag's two progress numbers this rider reads. */
    readonly side: "current" | "prev";
    /** The curve that screen's own pop runs, `undefined` for the CSS default. */
    readonly ease: VariantMotion["ease"];
    /**
     * How long that pop runs, which is what turns the screen's own progress
     * into SECONDS. A rider on a shorter clock of its own covers those seconds
     * faster, exactly as it does in the flight.
     */
    readonly duration: number;
  };
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
  /** Which of a drag's two progress numbers this one reads. */
  readonly side: "current" | "prev";
  /** The curve the gesture's progress is read through. See `scrub`. */
  readonly phaseEase: VariantMotion["ease"];
  /** The clock that curve belongs to, in seconds. See `scrub`. */
  readonly phaseDuration: number;
  /**
   * Where the finger has left this rider on its OWN clock, 0 to 1.
   *
   * Per rider rather than one number for the gesture: the two sides of a drag
   * need not report the same progress (`material` walks the covered screen to
   * `PULL` and stops it there while the dragged one keeps going), and two
   * riders on one side need not share a curve.
   */
  at: number;
}

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

  for (const { element, motion, phase } of riders) {
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
      clock: { start: motion.delay, duration: motion.duration, ease: motion.ease },
      side: phase?.side ?? "current",
      // A rider with no screen to be in phase with is its own phase, which is
      // the position-controlled scrub this had before any of them named one.
      phaseEase: phase ? phase.ease : motion.ease,
      phaseDuration: phase ? phase.duration : motion.duration,
      at: 0
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
    // THE FINGER OWNS THE SCREEN'S POSITION. EVERYTHING ELSE OWNS ITS TIME.
    //
    // A drag is position-controlled: the finger says where the screen's edge
    // is, so `scrubTo` seeks the screen through the INVERSE of its own curve.
    // That is right for the screen and it was wrong for everything riding it,
    // because inverting a rider through its OWN curve cancels that curve: every
    // rider then sat at the same fraction of its travel as the gesture, whatever
    // it had authored. A flight cancels nothing. So the same hand-over was two
    // different motions depending on whether a finger or a status started it,
    // and the curve an author wrote only ever appeared on release.
    //
    // Reported from the playground: a swipe-back looked like a different
    // transition from the pop it walks. Measured with this package's own
    // sampler, a part left on the CSS default under cupertino's
    // `[0.32, 0.72, 0, 1]` is 37.5 percentage points from where the same
    // gesture would put it, at 161ms of a 0.7s flight.
    //
    // So a rider reads the gesture through the SCREEN'S curve, which answers
    // WHERE IN THE FLIGHT that screen position is, in seconds. Its own clock
    // then says how far along its own travel those seconds put it, and its own
    // curve does the rest. A rider that inherits the screen's clock, which is
    // every part that authors no length, therefore lands exactly where the pop
    // would have it; one on a shorter clock of its own covers those seconds
    // faster and finishes early, which is also what the pop does.
    //
    // WHAT IS STILL NOT THE FLIGHT is a declared DELAY. The finger starts the
    // travel immediately, because a drag that does nothing for the first sixty
    // per cent of its length reads as broken; that rule is older than this and
    // is pinned in this file's first test.
    //
    // Per rider, because the two sides of a drag need not report the same
    // progress and a part and the dim need not share a clock.
    scrub: (progress: number | { current: number; prev: number }) => {
      if (released) return;
      for (const rider of staged) {
        const reported = typeof progress === "number" ? progress : progress[rider.side];
        const clamped = reported < 0 ? 0 : reported > 1 ? 1 : reported;
        // Seconds into the flight, then that as a fraction of this rider's own
        // travel. The two are the same number only when the clocks are, which
        // is why the phase carries a length as well as a curve.
        const seconds = invertEasing(rider.phaseEase)(clamped) * rider.phaseDuration;
        const reached = rider.clock.duration > 0 ? seconds / rider.clock.duration : 1;
        rider.at = reached > 1 ? 1 : reached;
        scrubToTime([rider.animation], rider.clock, rider.at);
      }
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
            /* v8 ignore next 2 -- the leg is null only where the host refused
               the staging seek, which is the ignored branch in `leg` above. */
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
        // pose the finger left sits at `1 - pose` along it, and playing forward
        // walks the author's own motion home.
        //
        // `rider.at` is the rider's own TIME, which is what the scrub now
        // leaves behind; the pose it is showing is that time through its own
        // curve. A commit therefore continues from that time directly, and a
        // cancel has to go back through the curve to find the mirrored one.
        // Where the phase is the rider's own the two reduce to what this always
        // computed from the gesture's progress.
        const leg = commit ? rider.commitLeg : rider.cancelLeg;
        const durationMs = rider.clock.duration * 1000;
        const pose = resolveEasing(rider.clock.ease)(rider.at);
        const at = commit
          ? rider.at * durationMs
          : invertEasing(rider.clock.ease)(1 - pose) * durationMs;
        const remaining = durationMs - at;
        if (!leg || remaining <= 0) {
          // Nothing left to fly, or a host that refused the staging: the drag
          // animation still holds the pose and the landing below lands it.
          rider.animation.pause();
        } else {
          // One copy of the placement arithmetic, shared with the morph's own
          // return: what is left of the leg's clock covers the release.
          placeLeg(leg, at, remaining, seconds);
        }
      }
      return Promise.all(landings).then(() => undefined);
    }
  };
};

export default beginRiderSwipe;
