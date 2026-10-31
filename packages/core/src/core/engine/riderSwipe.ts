import animateInline from "@transition/animateInline";
import { easingToCss, TRANSFORM_PROPS, targetToDecls } from "@transition/compileTransitionStyles";
import {
  easeControlPoints,
  invertEasing,
  resolveEasing,
  splitCubicBezier
} from "@transition/cubicBezier";
import { holdScrubAt, scrubToTime } from "@transition/gestureScrub";
import type { VariantMotion } from "@transition/variantMotion";

import { SKIP_ANIMATION_ATTR } from "@dom/attributes";

// WHAT RIDES A TRANSITION FOLLOWS THE FINGER.
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
   * mid-transition and it vanishes rather than leaving. Device-reported the first
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
   * transition it walks reading as the same motion. See `scrub`.
   */
  readonly phase?: {
    /** Which of a drag's two progress numbers this rider reads. */
    readonly side: "current" | "prev";
    /** The curve that screen's own pop runs, `undefined` for the CSS default. */
    readonly ease: VariantMotion["ease"];
    /**
     * How long that pop runs, which is what turns the screen's own progress
     * into SECONDS. A rider on a shorter clock of its own covers those seconds
     * faster, exactly as it does in the transition.
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

interface Length {
  readonly px?: number;
  readonly percent?: number;
}

/** The one translate axis a rider travels, as its author wrote the two ends. */
interface TravelAxis {
  readonly axis: "x" | "y";
  readonly from: Length;
  readonly to: Length;
}

/** That axis on screen, in CSS pixels: where the box sits untranslated, and its two ends. */
interface AxisGrid {
  readonly origin: number;
  readonly from: number;
  readonly to: number;
}

interface StagedRider {
  readonly element: HTMLElement;
  /** The one the finger moves. Its time is written, never played. */
  readonly animation: Animation;
  /** The declared path, forward. A release builds its motion from it. */
  readonly frames: readonly Keyframe[];
  readonly to: VariantMotion["to"];
  readonly clock: { start: number; duration: number; ease: VariantMotion["ease"] };
  /** Which of a drag's two progress numbers this one reads. */
  readonly side: "current" | "prev";
  /** The curve the gesture's progress is read through. See `scrub`. */
  readonly phaseEase: VariantMotion["ease"];
  /** The clock that curve belongs to, in seconds. See `scrub`. */
  readonly phaseDuration: number;
  /** What `alignToDevicePixels` can line up, or null for a rider it leaves alone. */
  readonly travel: TravelAxis | null;
  /** Measured on the first scrub that finds the rider laid out. */
  grid: AxisGrid | null;
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

const LENGTH = /^(-?\d*\.?\d+)(px|%)?$/;

const lengthOf = (raw: unknown): Length | null => {
  if (typeof raw === "number") return Number.isFinite(raw) ? { px: raw } : null;
  if (typeof raw !== "string") return null;
  const match = LENGTH.exec(raw.trim());
  if (!match) return null;
  const value = Number.parseFloat(match[1]!);
  return match[2] === "%" ? { percent: value } : { px: value };
};

/**
 * The axis a rider slides along, when sliding is ALL its transform does.
 *
 * Only a plain two-pose slide lines up with the pixel grid by moving its time:
 * a scale or a rotation puts its content off the grid whatever the
 * translation is, and a drag with stops does not map one time to one place.
 */
const travelOf = (motion: VariantMotion): TravelAxis | null => {
  if (motion.via && motion.via.length > 0) return null;
  const from = (motion.from ?? {}) as Record<string, unknown>;
  const to = (motion.to ?? {}) as Record<string, unknown>;
  const moved = [...new Set([...Object.keys(from), ...Object.keys(to)])].filter((key) =>
    TRANSFORM_PROPS.has(key)
  );
  if (moved.length !== 1) return null;
  const axis = moved[0];
  if (axis !== "x" && axis !== "y") return null;
  const start = lengthOf(from[axis] ?? 0);
  const end = lengthOf(to[axis] ?? 0);
  return start && end ? { axis, from: start, to: end } : null;
};

/**
 * Where the rider's box sits on its axis without the slide, read once it is laid
 * out.
 *
 * The rect includes the pose the drag animation is holding, which is `at`
 * through the rider's own curve, so that pose is taken back off it. A screen the
 * drag is still waking is `display: none` and measures zero; it is asked again
 * on the next scrub.
 */
const measureGrid = (rider: StagedRider): AxisGrid | null => {
  const travel = rider.travel;
  /* v8 ignore next -- only a rider with a travel is ever measured. */
  if (!travel || typeof rider.element.getBoundingClientRect !== "function") return null;
  const rect = rider.element.getBoundingClientRect();
  const size = travel.axis === "x" ? rect.width : rect.height;
  if (!(size > 0)) return null;
  const px = (length: Length) => length.px ?? ((length.percent ?? 0) / 100) * size;
  const from = px(travel.from);
  const to = px(travel.to);
  const shown = from + (to - from) * resolveEasing(rider.clock.ease)(rider.at);
  return { origin: (travel.axis === "x" ? rect.left : rect.top) - shown, from, to };
};

/**
 * The time nearest `at` whose pose puts the rider on a whole DEVICE pixel.
 *
 * A DRAG HOLDS EVERY FRAME AT A FRACTION OF A PIXEL, AND A TRANSITION DOES NOT.
 *
 * The finger seeks the drag animation once per frame, and each seek is a static
 * pose: whatever fraction of a device pixel it lands on, the layer is resampled
 * there, and the fraction changes unevenly from one frame to the next because
 * the finger does. Text and hairlines read that as sizzle. The covered screen
 * shows it most, because it walks back only its parallax and so creeps at a
 * fraction of the finger's speed. Reported on an iPad Pro, whose 2x panel puts
 * the resampling at its most visible, while a button pop over the same screens
 * was clean.
 *
 * Holding the pose on the grid is what device-verified on a 2x panel before:
 * an always-snapped pose cleared this class of shimmer where a gated one let it
 * back (see the motion-jank postmortem). Blink already rounds a static
 * translation to whole device pixels, so there this changes nothing drawn.
 */
const alignToDevicePixels = (rider: StagedRider, grid: AxisGrid, at: number): number => {
  const span = grid.to - grid.from;
  if (Math.abs(span) < 1e-6) return at;
  const ratio = typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const place = grid.origin + grid.from + span * resolveEasing(rider.clock.ease)(at);
  const pose = (Math.round(place * ratio) / ratio - grid.origin - grid.from) / span;
  return invertEasing(rider.clock.ease)(pose < 0 ? 0 : pose > 1 ? 1 : pose);
};

const kebab = (property: string): string =>
  property.startsWith("--")
    ? property
    : property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The properties a path animates, without the members that only time it. */
const propertiesOf = (frames: readonly Keyframe[]): string[] => [
  ...new Set(
    frames.flatMap((frame) =>
      Object.keys(frame).filter(
        (key) => key !== "offset" && key !== "easing" && key !== "composite"
      )
    )
  )
];

/**
 * The pose the element is showing, for every property the path animates, or
 * null when one of them has no value to read.
 */
const poseOnScreen = (element: HTMLElement, properties: readonly string[]): Keyframe | null => {
  if (typeof getComputedStyle !== "function") return null;
  const style = getComputedStyle(element);
  const frame: Keyframe = {};
  for (const property of properties) {
    const value = style.getPropertyValue(kebab(property));
    if (!value) return null;
    frame[property] = value;
  }
  return frame;
};

interface ReleasePlan {
  readonly frames: Keyframe[];
  readonly easing: string;
  readonly duration: number;
  readonly delay: number;
}

/**
 * The motion a release runs: the rest of the path the finger left, on the rest
 * of the author's curve, in the time the release settled on.
 *
 * Null when nothing is left to travel.
 */
const planRelease = (rider: StagedRider, commit: boolean, spanMs: number): ReleasePlan | null => {
  // The cancel's frames are reversed, so the pose the finger left sits at
  // `1 - pose` along it, and playing forward walks the author's own motion
  // home. `rider.at` is the rider's own TIME, which is what the scrub leaves
  // behind; the pose it is showing is that time through its own curve. A commit
  // therefore continues from that time directly, and a cancel has to go back
  // through the curve to find the mirrored one.
  const path = commit ? [...rider.frames] : reversedFrames(rider.frames);
  const { ease } = rider.clock;
  const durationMs = rider.clock.duration * 1000;
  const time = commit ? rider.at : invertEasing(ease)(1 - resolveEasing(ease)(rider.at));
  if (time >= 1 || durationMs <= 0) return null;

  // THE REST OF THE CURVE IS A CURVE OF ITS OWN, so the release can be born
  // at the pose on screen with nothing written into its clock (see below).
  const points = easeControlPoints(ease);
  const linear = !points && easingToCss(ease) === "linear";
  const split = points
    ? splitCubicBezier(points, time)
    : linear
      ? { progress: time, points: null }
      : null;
  if (points && !split) return null;
  if (split && split.progress >= 0 && split.progress < 1) {
    const last = path.length - 1;
    const stops = path.slice(1, last);
    const current = poseOnScreen(rider.element, propertiesOf(path));
    if (current && stops.every((frame) => typeof frame.offset === "number")) {
      const height = 1 - split.progress;
      const frames: Keyframe[] = [{ ...current, offset: 0 }];
      for (const stop of stops) {
        const offset = ((stop.offset as number) - split.progress) / height;
        if (offset > 0 && offset < 1) frames.push({ ...stop, offset });
      }
      frames.push({ ...path[last]!, offset: 1 });
      return {
        frames,
        easing: split.points ? `cubic-bezier(${split.points.join(", ")})` : "linear",
        duration: spanMs,
        delay: 0
      };
    }
  }

  // No handles to split (`steps()`, the `linear()` a spring ships as), or a
  // pose the host would not report: the whole path, born part of the way in.
  const scale = spanMs / ((1 - time) * durationMs);
  return {
    frames: path,
    easing: easingToCss(ease),
    duration: durationMs * scale,
    delay: -time * durationMs * scale
  };
};

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

    staged.push({
      element,
      animation,
      frames,
      to: motion.to,
      clock: { start: motion.delay, duration: motion.duration, ease: motion.ease },
      side: phase?.side ?? "current",
      // A rider with no screen to be in phase with is its own phase, which is
      // the position-controlled scrub this had before any of them named one.
      phaseEase: phase ? phase.ease : motion.ease,
      phaseDuration: phase ? phase.duration : motion.duration,
      travel: travelOf(motion),
      grid: null,
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
    // it had authored. A transition cancels nothing. So the same hand-over was two
    // different motions depending on whether a finger or a status started it,
    // and the curve an author wrote only ever appeared on release.
    //
    // Reported from the playground: a swipe-back looked like a different
    // transition from the pop it walks. Measured with this package's own
    // sampler, a part left on the CSS default under cupertino's
    // `[0.32, 0.72, 0, 1]` is 37.5 percentage points from where the same
    // gesture would put it, at 161ms of a 0.7s transition.
    //
    // So a rider reads the gesture through the SCREEN'S curve, which answers
    // WHERE IN THE TRANSITION that screen position is, in seconds. Its own clock
    // then says how far along its own travel those seconds put it, and its own
    // curve does the rest. A rider that inherits the screen's clock, which is
    // every part that authors no length, therefore lands exactly where the pop
    // would have it; one on a shorter clock of its own covers those seconds
    // faster and finishes early, which is also what the pop does.
    //
    // WHAT IS STILL NOT THE TRANSITION is a declared DELAY. The finger starts the
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
        // Seconds into the transition, then that as a fraction of this rider's own
        // travel. The two are the same number only when the clocks are, which
        // is why the phase carries a length as well as a curve.
        const seconds = invertEasing(rider.phaseEase)(clamped) * rider.phaseDuration;
        const reached = rider.clock.duration > 0 ? seconds / rider.clock.duration : 1;
        let at = reached > 1 ? 1 : reached;
        if (rider.travel) {
          rider.grid ??= measureGrid(rider);
          if (rider.grid) at = alignToDevicePixels(rider, rider.grid, at);
        }
        rider.at = at;
        scrubToTime([rider.animation], rider.clock, rider.at);
      }
    },
    settle: (commit: boolean, seconds: number) => {
      if (released) return Promise.resolve();
      released = true;
      const spanMs = Math.max(seconds, 1 / 60) * 1000;
      // A RELEASE IS NOT THE DRAG PLAYED ON, AND NOT A HELD ANIMATION WOKEN UP.
      //
      // The drag is position-controlled: the finger says where, and the scrub
      // seeks the animation to the time that pose sits at. A release is
      // time-controlled: a curve and a duration say where. Sharing one
      // animation between them makes the release inherit the drag's mapping,
      // and then which part of the authored curve it lands on is an accident of
      // where the finger stopped — a cancel always stops inside the curve's
      // opening, which is that curve's own tangent, so the return came home at
      // a dead constant speed (device-captured at 30ms of cupertino's 700 for a
      // drag 9% across).
      //
      // The release used to be legs staged with the drag, parked out of
      // effect, then seeked, re-rated and given a start time by hand on the
      // frame the finger lifted. That is a held animation woken up with its
      // clock rewritten, and WebKit does not keep such an animation off the
      // main thread: the postmortem's do-not-retry list records both a scrubbed
      // animation losing its accelerated form when it plays again and clock
      // writes into accelerated animations losing the race. A button pop runs
      // an animation that was simply BORN running, and that is the one an iPad
      // Pro drew clean while the same screens shimmered on release.
      //
      // So the release is born here, running, from the pose on screen: the
      // rest of the path, on the rest of the author's curve (`splitCubicBezier`),
      // scaled into the time the release settled on. Nothing is written into its
      // clock after birth, and it is the only animation its element carries —
      // the drag is let go in the same task, so no frame shows the element
      // without one, and neither engine has a paused animation underneath to
      // draw instead (Blink would not composite beside one; WebKit drew it).
      //
      // Every pose is read before any animation changes, so the reads cost one
      // style resolution rather than one per rider.
      const plans = staged.map((rider) => planRelease(rider, commit, spanMs));
      const landings: Promise<void>[] = [];
      staged.forEach((rider, index) => {
        const plan = plans[index]!;
        if (commit) rider.element.setAttribute(SKIP_ANIMATION_ATTR, "true");
        let release: Animation | null = null;
        if (plan) {
          rider.animation.cancel();
          release = rider.element.animate(plan.frames, {
            duration: plan.duration,
            delay: plan.delay,
            easing: plan.easing,
            // The landed pose holds until the landing below hands it to a
            // basis that is not an animation.
            fill: "forwards"
          });
        } else {
          // Nothing left to move: the drag animation still holds the pose and
          // the landing below lands it.
          rider.animation.pause();
        }
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
                // the screen that moved out rests where it started, and the
                // screen that came home rests at the parallax the pop was
                // supposed to take it out of. Both blinked — measured on the
                // bench as the returning screen dropping to -117px for two
                // frames before the stack re-rendered it as the active one.
                //
                // Holding the animation's own fill instead was tried first and
                // WebKit did not honour it. An inline write does, and it is
                // what this path left behind before the drag became an
                // animation; the transition's COMPLETED cleanup strips it.
                void animateInline(rider.element, rider.to, { duration: 0 }, writer);
              }
              // BOTH DIRECTIONS HAND THE ELEMENT BACK.
              //
              // A staged animation carries a fill, so one left behind holds its
              // end pose for good — and a gesture-driven rider is not a
              // throwaway like the departing screen's parts: the screen a swipe
              // RETURNS to survives, and its parts then wore the finished pose
              // into the next transition, where they fought the compiled rule
              // that was supposed to move them. Reported as the previous
              // element overlapping and then vanishing on the next push, and as
              // a pop that would not run its whole way.
              rider.animation.cancel();
              release?.cancel();
              rider.element.removeAttribute(SKIP_ANIMATION_ATTR);
              resolve();
            };
            // Forward in both directions, so the landing is the ordinary
            // `finish` either way.
            release?.addEventListener("finish", land, { once: true });
            // The backstop the transition's own resolver keeps, for the same
            // reason: an animation torn down before it finishes fires nothing,
            // and a caller waiting on this must not wait for ever.
            if (typeof setTimeout === "function") {
              setTimeout(land, Math.max(seconds, 0) * 1000 + 60);
            }
          })
        );
      });
      return Promise.all(landings).then(() => undefined);
    }
  };
};

export default beginRiderSwipe;
