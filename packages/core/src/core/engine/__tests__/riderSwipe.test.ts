import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { invertEasing } from "@transition/cubicBezier";
import type { VariantMotion } from "@transition/variantMotion";

import { beginRiderSwipe, type RiderMotion } from "@core/engine/riderSwipe";

import { SKIP_ANIMATION_ATTR } from "@dom/attributes";

// WHAT RIDES A FLIGHT FOLLOWS THE FINGER.
//
// A drag flips no status — `isReadyForDrag` requires COMPLETED and the
// navigation only begins at `back()` — so the compiled rules never match and a
// `<Part>` or a dim that declared only a pose sat still while the screens moved
// under it. The gesture stages their animations itself and moves them by hand,
// which is the model the morph has used since it learned it.

// jsdom implements Element.animate but not a timeline that advances, which is
// exactly the surface under test: the finger sets the time, nothing else does.
interface FakeAnimation {
  currentTime: number | null;
  playbackRate: number;
  paused: boolean;
  played: boolean;
  cancelled: boolean;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  listeners: Record<string, (() => void)[]>;
  pause: () => void;
  play: () => void;
  cancel: () => void;
  addEventListener: (type: string, fn: () => void) => void;
}

const animations: FakeAnimation[] = [];

const stubAnimate = (element: HTMLElement) => {
  element.animate = ((keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    const animation: FakeAnimation = {
      currentTime: 0,
      playbackRate: 1,
      paused: false,
      played: false,
      cancelled: false,
      keyframes,
      options,
      listeners: {},
      pause() {
        this.paused = true;
      },
      play() {
        this.played = true;
        this.paused = false;
      },
      cancel() {
        this.cancelled = true;
      },
      addEventListener(type, fn) {
        (this.listeners[type] ??= []).push(fn);
      }
    };
    animations.push(animation);
    return animation as unknown as Animation;
  }) as HTMLElement["animate"];
};

const motion = (over: Partial<VariantMotion> = {}): VariantMotion => ({
  from: { opacity: 0 },
  to: { opacity: 1 },
  duration: 0.4,
  delay: 0,
  ease: undefined,
  ...over
});

let element: HTMLElement;

beforeEach(() => {
  animations.length = 0;
  element = document.createElement("div");
  document.body.appendChild(element);
  stubAnimate(element);
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("beginRiderSwipe", () => {
  // A DECLARED DELAY IS DEAD TIME IN A FLIGHT AND NO TIME AT ALL UNDER A FINGER.
  //
  // A part can author one: the playground's card chrome waits a quarter of a
  // second before it goes, so it is still there while the card is large enough
  // to hold it. In a FLIGHT that is exactly what it should be — the element
  // sits at its from-pose and then moves.
  //
  // A DRAG cannot spend the finger on it. The chrome above declares 0.24s of
  // delay against 0.16s of travel, so honouring the delay under the finger
  // would leave the first sixty per cent of the drag doing nothing at all. The
  // scrub seeks past it instead: progress 0 lands on the delay's last frame and
  // progress 1 on the end, so the finger maps to the TRAVEL. Nothing pinned
  // that, and it lives in one term (`clock.start`) that reads like an offset
  // somebody could helpfully remove.
  it("spends the finger on the travel, not on the delay in front of it", () => {
    const delayed = motion({ duration: 0.16, delay: 0.24 });
    const swipe = beginRiderSwipe([{ element, motion: delayed }])!;
    const [drag, commitLeg, cancelLeg] = animations;

    // The delay is carried, so a flight staged from these keyframes waits.
    expect(drag!.options.delay).toBe(240);
    expect(drag!.options.duration).toBe(160);

    swipe.scrub(0);
    expect(drag!.currentTime).toBe(240);
    // A tenth of a millisecond short of 400: the travel's own end belongs to
    // the release, and a scrub that reaches it takes the animation out of its
    // active phase, which fires `animationend` on a paused animation that never
    // ran. See `scrubTo`.
    swipe.scrub(1);
    expect(drag!.currentTime).toBeCloseTo(399.9, 5);
    swipe.scrub(0.5);
    expect(drag!.currentTime).toBeGreaterThan(240);
    expect(drag!.currentTime).toBeLessThan(400);

    // And the release starts from where the finger left it, so neither leg
    // carries the wait: a cancel that replayed it would hang before moving.
    for (const leg of [commitLeg!, cancelLeg!]) {
      expect(leg.options.delay).toBeUndefined();
      expect(leg.options.duration).toBe(160);
    }
  });

  it("stages the drag and both motions a release can be", () => {
    // A release is not the drag played on. The drag is position-controlled and
    // the release is time-controlled, so sharing one animation makes the
    // release inherit the drag's mapping and land on whatever part of the
    // authored curve the finger happened to stop in. Both legs are staged HERE,
    // out of effect, so the release only seeks and plays one.
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);

    expect(swipe).not.toBeNull();
    expect(animations).toHaveLength(3);

    const [drag, commitLeg, cancelLeg] = animations;
    expect(drag!.keyframes).toEqual([{ opacity: "0" }, { opacity: "1" }]);
    expect(drag!.options.duration).toBe(400);
    expect(drag!.options.fill).toBe("both");
    // Held at zero: the finger owns the time from the first frame.
    expect(drag!.paused).toBe(true);
    expect(drag!.currentTime).toBe(0);

    // The commit's path is the declared one; the cancel's is it reversed, so
    // playing that FORWARD is the author's own motion arriving back home.
    expect(commitLeg!.keyframes.map((frame) => frame.opacity)).toEqual(["0", "1"]);
    expect(cancelLeg!.keyframes.map((frame) => frame.opacity)).toEqual(["1", "0"]);
    // Parked before their own start, where `forwards` fills nothing.
    for (const leg of [commitLeg!, cancelLeg!]) {
      expect(leg.options.fill).toBe("forwards");
      expect(leg.paused).toBe(true);
      expect(leg.currentTime).toBeLessThan(0);
    }
  });

  it("converts a CSS property name to the one WAAPI takes", () => {
    // The compiler emits kebab-case because a stylesheet takes that; a keyframe
    // object takes the IDL name. One conversion, so a pose cannot be described
    // two different ways.
    beginRiderSwipe([
      {
        element,
        motion: motion({ from: { backgroundColor: "red" }, to: { backgroundColor: "blue" } })
      }
    ]);

    expect(animations[0]!.keyframes).toEqual([
      { backgroundColor: "red" },
      { backgroundColor: "blue" }
    ]);
  });

  it("moves to a fraction of the TRAVEL, not of the clock", () => {
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);

    swipe!.scrub(0.5);

    // Half the TRAVEL is not half the clock under an eased curve, which is the
    // whole reason the drag is inverted through the easing before it becomes a
    // time: a finger a tenth of the way across moves an element a fiftieth,
    // and taking the drag as the clock leaves the release to rush the rest.
    const half = animations[0]!.currentTime!;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(400);
    expect(half).not.toBe(200);

    // The ends still land on the ends — the far one a hair short of it, which
    // is the scrub keeping the animation inside its active phase (see
    // `scrubTo`).
    swipe!.scrub(0);
    expect(animations[0]!.currentTime).toBe(0);
    swipe!.scrub(1);
    expect(animations[0]!.currentTime).toBeCloseTo(399.9, 5);
  });

  it("clamps a drag that runs past either end", () => {
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);

    swipe!.scrub(-1);
    expect(animations[0]!.currentTime).toBe(0);
    swipe!.scrub(2);
    expect(animations[0]!.currentTime).toBeCloseTo(399.9, 5);
  });

  it("plays out on commit and suppresses the keyframe the landing would replay", () => {
    // The same contract the swipe already applies to the screen and the dim:
    // the gesture animated it, so the navigation must not start it over from
    // its `from` pose.
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);
    swipe!.scrub(0.5);

    swipe!.settle(true, 0.2);

    expect(element.getAttribute(SKIP_ANIMATION_ATTR)).toBe("true");
    // The COMMIT leg flies, forward, and the drag animation is left where the
    // finger put it until the landing clears everything.
    expect(animations[1]!.played).toBe(true);
    expect(animations[1]!.playbackRate).toBeGreaterThan(0);
    expect(animations[0]!.played).toBe(false);
  });

  it("hands the element back when a COMMITTED settle finishes", () => {
    // A staged animation carries `fill: both`, so one left behind holds its end
    // pose for good. The screen a swipe returns to SURVIVES, and its parts then
    // wore that pose into the next flight and fought the compiled rule meant to
    // move them: reported as the previous element overlapping and then
    // vanishing on the next push.
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);
    swipe!.scrub(0.5);
    swipe!.settle(true, 0.2);

    animations[1]!.listeners.finish?.forEach((fn) => fn());

    // Everything the gesture staged goes, not just the one that flew.
    for (const animation of animations) expect(animation.cancelled).toBe(true);
    expect(element.hasAttribute(SKIP_ANIMATION_ATTR)).toBe(false);
  });

  it("flies the reversed leg FORWARD on cancel, so the return has a landing", () => {
    // Playing the drag backwards is what left a cancel with no easing at all:
    // it walks back through the authored curve's opening, which is that curve's
    // own tangent, and the deceleration the author drew is at the far end where
    // a cancel never reaches. The reversed leg puts that landing where the
    // cancel actually arrives.
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);
    swipe!.scrub(0.5);

    swipe!.settle(false, 0.2);

    expect(element.hasAttribute(SKIP_ANIMATION_ATTR)).toBe(false);
    expect(animations[2]!.played).toBe(true);
    expect(animations[2]!.playbackRate).toBeGreaterThan(0);
    // Forward in both directions, so the ordinary `finish` is the landing.
    animations[2]!.listeners.finish?.forEach((fn) => fn());
    for (const animation of animations) expect(animation.cancelled).toBe(true);
  });

  it("ignores a scrub that lands after the release", () => {
    // The finger's last move can arrive after the settle has already taken the
    // riders over; scrubbing then would drag a landing animation backwards.
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);
    swipe!.scrub(0.5);
    const scrubbed = animations[0]!.currentTime;

    swipe!.settle(true, 0.2);
    swipe!.scrub(0.9);

    expect(animations[0]!.currentTime).toBe(scrubbed);
    expect(swipe!.active).toBe(false);
  });

  it("settles once, however many times the release reports", () => {
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);

    swipe!.settle(true, 0.2);
    const rate = animations[1]!.playbackRate;
    swipe!.settle(false, 0.2);

    expect(animations[1]!.playbackRate).toBe(rate);
    // The cancel leg was never woken by the second report.
    expect(animations[2]!.played).toBe(false);
    expect(swipe!.active).toBe(false);
  });

  it("gives each rider its own clock", () => {
    // A part and the dim need not share one: each inherits from the same screen
    // variant, and an author may have written a longer one on either.
    const other = document.createElement("div");
    document.body.appendChild(other);
    stubAnimate(other);

    const swipe = beginRiderSwipe([
      { element, motion: motion({ duration: 0.4 }) },
      { element: other, motion: motion({ duration: 1 }) }
    ]);
    swipe!.scrub(0.5);

    // Same curve, different spans: the longer rider sits proportionally later
    // on its own clock rather than being dragged onto its neighbour's.
    // Three animations per rider now, so the second rider's drag is index 3.
    expect(animations[3]!.currentTime! / animations[0]!.currentTime!).toBeCloseTo(1 / 0.4, 5);
  });

  it("mirrors a declared stop onto the leg that walks home", () => {
    // The generality claim, pinned: nothing here knows what a transition
    // declares. A stop a quarter of the way out is a stop three quarters of the
    // way home, so a drag whose properties travel at different rates retraces
    // them rather than cutting straight back.
    beginRiderSwipe([
      {
        element,
        motion: motion({ via: [{ at: 0.25, value: { opacity: 0.4 } }] })
      }
    ]);

    const [, commitLeg, cancelLeg] = animations;
    expect(commitLeg!.keyframes.map((frame) => frame.offset)).toEqual([undefined, 0.25, undefined]);
    // Reversed, so the arrival pose leads at 0 and the drag's origin closes at
    // 1, with the stop three quarters of the way home.
    expect(cancelLeg!.keyframes.map((frame) => frame.offset)).toEqual([0, 0.75, 1]);
    expect(cancelLeg!.keyframes.map((frame) => frame.opacity)).toEqual(["1", "0.4", "0"]);
  });

  it("reports itself stale once its element leaves the document", () => {
    // An animation does not follow its element out, so a rider whose node was
    // replaced by the wake the drag caused has to be staged again.
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);

    expect(swipe!.stale).toBe(false);
    element.remove();
    expect(swipe!.stale).toBe(true);
  });

  it("places the leg against a resolved timeline rather than playing it", () => {
    // `play()` leaves an animation play-PENDING, and the two engines resolve
    // the start time it lands on differently. A start written by hand has no
    // pending frame to disagree about.
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);
    swipe!.scrub(0.5);
    const cancelLeg = animations[2]!;
    (cancelLeg as unknown as { timeline: { currentTime: number } }).timeline = {
      currentTime: 5_000
    };

    swipe!.settle(false, 0.2);

    expect(cancelLeg.played).toBe(false);
    expect((cancelLeg as unknown as { startTime?: number }).startTime).toBeLessThan(5_000);
  });

  it("leaves a rider the release has nothing left to fly", () => {
    // Cancelled without ever having moved: the leg is already standing on the
    // pose it would land at, and the landing below still hands the element
    // back. Flying a zero-length leg would only delay it.
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);
    swipe!.scrub(0);

    swipe!.settle(false, 0.2);

    expect(animations[2]!.played).toBe(false);
    expect(animations[0]!.paused).toBe(true);
  });

  it("lands once, whether the finish or the backstop gets there first", () => {
    // Both are wired on purpose: an animation torn down before it finishes
    // fires nothing, and a caller waiting on the landing must not wait for
    // ever. Whichever arrives second must not hand the element back twice.
    vi.useFakeTimers();
    try {
      const swipe = beginRiderSwipe([{ element, motion: motion() }]);
      swipe!.scrub(0.5);
      swipe!.settle(false, 0.2);

      animations[2]!.listeners.finish?.forEach((fn) => fn());
      const cancelledOnce = animations.map((animation) => animation.cancelled);
      vi.advanceTimersByTime(1_000);

      expect(animations.map((animation) => animation.cancelled)).toEqual(cancelledOnce);
    } finally {
      vi.useRealTimers();
    }
  });

  it("drives nothing for a rider with no motion to run", () => {
    expect(beginRiderSwipe([{ element, motion: motion({ duration: 0 }) }])).toBeNull();
    expect(beginRiderSwipe([])).toBeNull();
    expect(animations).toHaveLength(0);
  });
});

// THE FINGER OWNS THE SCREEN'S POSITION. EVERYTHING ELSE OWNS ITS TIME.
//
// Seeking a rider through the inverse of its OWN curve cancels that curve: the
// rider then sits at the gesture's own fraction of its travel whatever it
// authored. A flight cancels nothing, so a drag and the pop it walks were two
// different motions, and the curve an author wrote only ever appeared on
// release. Reported from the playground as a swipe that looked like a different
// transition from the pop.
describe("a rider reads the gesture through the screen it rides", () => {
  const CUPERTINO: [number, number, number, number] = [0.32, 0.72, 0, 1];

  /** Where a rider's own animation has been put, as a fraction of its clock. */
  const timeFraction = (index: number, durationMs = 400) =>
    (animations[index]!.currentTime ?? 0) / durationMs;

  /** A screen on cupertino's curve, running the 0.4s these riders default to. */
  const screen = (over: Partial<NonNullable<RiderMotion["phase"]>> = {}) => ({
    side: "current" as const,
    ease: CUPERTINO,
    duration: 0.4,
    ...over
  });

  /**
   * Where a screen on `CUPERTINO` is in its own flight, in seconds, when it is
   * `p` across.
   *
   * Computed here rather than read back off the animation: an expectation taken
   * from the thing under test moves with it, and the first draft of these
   * passed against the arithmetic they were written to rule out.
   */
  const flightSeconds = (p: number, duration = 0.4) => invertEasing(CUPERTINO)(p) * duration;

  it("puts a rider at the flight time its screen is at, not at the gesture's", () => {
    const swipe = beginRiderSwipe([
      { element, motion: motion({ ease: "linear" }), phase: screen() }
    ]);

    swipe!.scrub(0.5);

    // Cupertino's curve is half travelled about a sixth of the way through its
    // clock, so a screen half-way across is a flight barely started and the
    // chrome on it has barely moved. Seeked through its OWN linear curve this
    // rider would have been at 0.5.
    expect(timeFraction(0)).toBeCloseTo(flightSeconds(0.5) / 0.4, 5);
    expect(timeFraction(0)).toBeLessThan(0.25);
  });

  // THE SCREEN'S PROGRESS IS A FRACTION OF THE SCREEN'S CLOCK, NOT OF THIS ONE.
  //
  // The playground's `detail-chrome` runs 0.16s against cupertino's 0.7s, so
  // the seconds a screen position stands for cover four times as much of the
  // part's travel. Reading the screen's fraction as if it were the part's put
  // that header at 3% of its travel where the flight has it at 49%, which is
  // the same class of mistake as the curve cancelling: a number carried across
  // a boundary it does not belong to.
  it("converts the screen's progress into seconds before reading its own clock", () => {
    const short = beginRiderSwipe([
      {
        element,
        motion: motion({ duration: 0.1, ease: "linear" }),
        phase: screen({ duration: 0.4 })
      }
    ]);

    short!.scrub(0.5);

    // A quarter of the screen's clock is the whole of this rider's, so the
    // seconds the screen is at put it most of the way along.
    const seconds = flightSeconds(0.5);
    expect(timeFraction(0, 100)).toBeCloseTo(seconds / 0.1, 5);
    expect(timeFraction(0, 100)).toBeGreaterThan(0.5);
  });

  it("holds a rider that finishes before the drag does", () => {
    // Its own clock runs out inside the flight, which is what the pop does too:
    // the chrome is gone and the screen is still sliding.
    const short = beginRiderSwipe([
      {
        element,
        motion: motion({ duration: 0.05, ease: "linear" }),
        phase: screen({ duration: 0.4 })
      }
    ]);

    short!.scrub(0.9);

    // At the end, less the guard that keeps a scrub inside the active phase:
    // a tenth of a millisecond is 0.2% of a 50ms clock.
    expect(timeFraction(0, 50)).toBeGreaterThan(0.99);
    expect(timeFraction(0, 50)).toBeLessThan(1);
  });

  it("changes nothing for a rider whose curve is already its screen's", () => {
    // Which, after `resolvePartClock`, is every part that does not name one.
    // The two arithmetics have to agree exactly there or this would be a
    // silent change to every existing drag.
    const own = beginRiderSwipe([{ element, motion: motion({ ease: CUPERTINO }) }]);
    own!.scrub(0.37);
    const positionControlled = timeFraction(0);

    animations.length = 0;
    const second = document.createElement("div");
    document.body.appendChild(second);
    stubAnimate(second);
    const phased = beginRiderSwipe([
      {
        element: second,
        motion: motion({ ease: CUPERTINO }),
        phase: screen()
      }
    ]);
    phased!.scrub(0.37);

    expect(timeFraction(0)).toBeCloseTo(positionControlled, 10);
  });

  it("reads the number belonging to the side it rides", () => {
    // `material` walks the covered screen to its pull and stops it there while
    // the dragged one keeps going. A part on the covered screen used to track
    // the finger past a screen that had stopped moving.
    const covered = document.createElement("div");
    document.body.appendChild(covered);
    stubAnimate(covered);

    const swipe = beginRiderSwipe([
      { element, motion: motion({ ease: "linear" }), phase: screen({ ease: "linear" }) },
      {
        element: covered,
        motion: motion({ ease: "linear" }),
        phase: screen({ side: "prev", ease: "linear" })
      }
    ]);

    swipe!.scrub({ current: 0.8, prev: 0.25 });

    expect(timeFraction(0)).toBeCloseTo(0.8, 5);
    expect(timeFraction(3)).toBeCloseTo(0.25, 5);
  });

  it("is its own phase when the screen it rides animates nothing", () => {
    // A side with no motion has no phase to be in, and the rider stays
    // position-controlled exactly as everything was before any of this.
    const swipe = beginRiderSwipe([{ element, motion: motion({ ease: CUPERTINO }) }]);

    swipe!.scrub(0.5);

    // Its own curve inverted: the pose is the gesture's half, and the TIME is
    // wherever that curve puts it.
    expect(timeFraction(0)).toBeLessThan(0.25);
  });

  it("continues the commit from the time the finger left, not from the gesture's", () => {
    const swipe = beginRiderSwipe([
      { element, motion: motion({ ease: "linear" }), phase: screen() }
    ]);
    swipe!.scrub(0.5);

    swipe!.settle(true, 0.2);

    // The commit leg is the same path forward, so it picks up at the flight
    // time the drag left. Seeking it to the gesture's 0.5 instead would jump
    // the chrome the moment the finger lifts.
    expect(animations[1]!.currentTime! / 400).toBeCloseTo(flightSeconds(0.5) / 0.4, 5);
    expect(animations[1]!.currentTime! / 400).not.toBeCloseTo(0.5, 2);
  });

  it("mirrors the cancel through the rider's own curve, not the gesture's number", () => {
    // The cancel's frames are reversed, so the pose on screen sits at `1 -
    // pose` along it, and the pose is the rider's TIME through its OWN curve.
    // This rider is linear, so its pose IS that time — and that is what has to
    // be mirrored, not the 0.5 the finger reported.
    const swipe = beginRiderSwipe([
      { element, motion: motion({ ease: "linear" }), phase: screen() }
    ]);
    swipe!.scrub(0.5);

    swipe!.settle(false, 0.2);

    expect(animations[2]!.currentTime! / 400).toBeCloseTo(1 - flightSeconds(0.5) / 0.4, 5);
    expect(animations[2]!.currentTime! / 400).not.toBeCloseTo(0.5, 2);
  });
});
