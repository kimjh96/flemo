import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { invertEasing, resolveEasing } from "@transition/cubicBezier";
import type { VariantMotion } from "@transition/variantMotion";

import { beginRiderSwipe, type RiderMotion } from "@core/engine/riderSwipe";

import { SKIP_ANIMATION_ATTR } from "@dom/attributes";

// WHAT RIDES A TRANSITION FOLLOWS THE FINGER.
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

/**
 * What the element reports as its computed pose, the one a release is born
 * from. jsdom resolves no animation into a computed style, so the test says what
 * the drag is showing.
 */
const showPose = (pose: Record<string, string>) => {
  vi.stubGlobal("getComputedStyle", () => ({
    getPropertyValue: (property: string) => pose[property] ?? ""
  }));
};

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
  // A DECLARED DELAY IS DEAD TIME IN A TRANSITION AND NO TIME AT ALL UNDER A FINGER.
  //
  // A part can author one: the playground's card chrome waits a quarter of a
  // second before it goes, so it is still there while the card is large enough
  // to hold it. In a TRANSITION that is exactly what it should be — the element
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
    const [drag] = animations;

    // The delay is carried, so a transition staged from these keyframes waits.
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

    // And the release starts from where the finger left it, so it carries no
    // wait: a cancel that replayed it would hang before moving.
    showPose({ opacity: "0.5" });
    swipe.settle(false, 0.2);
    expect(animations[1]!.options.delay).toBe(0);
  });

  it("stages the drag and nothing else", () => {
    // The release is not staged with the drag. A motion staged now has to be
    // woken later with its clock rewritten, and that is the form WebKit does
    // not keep on the compositor; the release is born when it happens instead
    // (see `settle`).
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);

    expect(swipe).not.toBeNull();
    expect(animations).toHaveLength(1);

    const [drag] = animations;
    expect(drag!.keyframes).toEqual([{ opacity: "0" }, { opacity: "1" }]);
    expect(drag!.options.duration).toBe(400);
    expect(drag!.options.fill).toBe("both");
    // Held at zero: the finger owns the time from the first frame.
    expect(drag!.paused).toBe(true);
    expect(drag!.currentTime).toBe(0);
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
    showPose({ opacity: "0.5" });

    swipe!.settle(true, 0.2);

    expect(element.getAttribute(SKIP_ANIMATION_ATTR)).toBe("true");
    // A release born forward, from the pose on screen to the arrival, in the
    // time the release settled on, and holding that arrival until the landing
    // hands it to an inline basis.
    const release = animations[1]!;
    expect(release.keyframes.map((frame) => frame.opacity)).toEqual(["0.5", "1"]);
    expect(release.options.duration).toBe(200);
    expect(release.options.fill).toBe("forwards");
    expect(animations[0]!.played).toBe(false);
  });

  it("hands the element back when a COMMITTED settle finishes", () => {
    // A staged animation carries `fill: both`, so one left behind holds its end
    // pose for good. The screen a swipe returns to SURVIVES, and its parts then
    // wore that pose into the next transition and fought the compiled rule meant to
    // move them: reported as the previous element overlapping and then
    // vanishing on the next push.
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);
    swipe!.scrub(0.5);
    showPose({ opacity: "0.5" });
    swipe!.settle(true, 0.2);

    animations[1]!.listeners.finish?.forEach((fn) => fn());

    // Everything the gesture animated goes, not just the one that moved.
    for (const animation of animations) expect(animation.cancelled).toBe(true);
    expect(element.hasAttribute(SKIP_ANIMATION_ATTR)).toBe(false);
  });

  it("walks the reversed path FORWARD on cancel, so the return has a landing", () => {
    // Playing the drag backwards is what left a cancel with no easing at all:
    // it walks back through the authored curve's opening, which is that curve's
    // own tangent, and the deceleration the author drew is at the far end where
    // a cancel never reaches. The reversed path puts that landing where the
    // cancel actually arrives.
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);
    swipe!.scrub(0.5);
    showPose({ opacity: "0.5" });

    swipe!.settle(false, 0.2);

    expect(element.hasAttribute(SKIP_ANIMATION_ATTR)).toBe(false);
    const release = animations[1]!;
    expect(release.keyframes.map((frame) => frame.opacity)).toEqual(["0.5", "0"]);
    expect(release.playbackRate).toBe(1);
    // Forward in both directions, so the ordinary `finish` is the landing.
    release.listeners.finish?.forEach((fn) => fn());
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
    showPose({ opacity: "0" });

    swipe!.settle(true, 0.2);
    swipe!.settle(false, 0.2);

    // One release, born by the first report; the second animated nothing.
    expect(animations).toHaveLength(2);
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
    expect(animations[1]!.currentTime! / animations[0]!.currentTime!).toBeCloseTo(1 / 0.4, 5);
  });

  it("mirrors a declared stop onto the path that walks home", () => {
    // The generality claim, pinned: nothing here knows what a transition
    // declares. A stop a quarter of the way out is a stop three quarters of the
    // way home, so a drag whose properties travel at different rates retraces
    // them rather than cutting straight back.
    const swipe = beginRiderSwipe([
      {
        element,
        motion: motion({ ease: "linear", via: [{ at: 0.25, value: { opacity: 0.4 } }] })
      }
    ]);
    // Nearly home already: a fifth of the way out, so the return has only its
    // last fifth left and the stop three quarters of the way home is behind
    // it. What remains is the pose on screen and the drag's origin.
    swipe!.scrub(0.2);
    showPose({ opacity: "0.3" });

    swipe!.settle(false, 0.2);

    const release = animations[1]!;
    expect(release.keyframes.map((frame) => frame.opacity)).toEqual(["0.3", "0"]);

    animations.length = 0;
    const far = document.createElement("div");
    document.body.appendChild(far);
    stubAnimate(far);
    const out = beginRiderSwipe([
      {
        element: far,
        motion: motion({ ease: "linear", via: [{ at: 0.25, value: { opacity: 0.4 } }] })
      }
    ]);
    // Most of the way out, so the stop three quarters of the way home is
    // still ahead of the return.
    out!.scrub(0.9);
    showPose({ opacity: "0.9" });

    out!.settle(false, 0.2);

    const home = animations[1]!;
    expect(home.keyframes.map((frame) => frame.opacity)).toEqual(["0.9", "0.4", "0"]);
    // 0.1 of the return walked, so the stop at 0.75 is (0.75 - 0.1) / 0.9 of
    // what is left.
    expect(home.keyframes[1]!.offset).toBeCloseTo(0.65 / 0.9, 10);
    expect(home.keyframes.map((frame) => frame.offset).at(0)).toBe(0);
    expect(home.keyframes.map((frame) => frame.offset).at(-1)).toBe(1);
  });

  it("reports itself stale once its element leaves the document", () => {
    // An animation does not follow its element out, so a rider whose node was
    // replaced by the wake the drag caused has to be staged again.
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);

    expect(swipe!.stale).toBe(false);
    element.remove();
    expect(swipe!.stale).toBe(true);
  });

  it("is born running, with nothing written into its clock", () => {
    // WebKit runs an animation BORN running on the compositor, and does not
    // keep one there that was held and then had its time, rate or start
    // written by hand: the motion-jank postmortem's do-not-retry list, and an
    // iPad Pro where the release shimmered while a button pop was clean.
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);
    swipe!.scrub(0.5);
    showPose({ opacity: "0.5" });

    swipe!.settle(false, 0.2);

    const release = animations[1]!;
    expect(release.paused).toBe(false);
    expect(release.played).toBe(false);
    expect(release.currentTime).toBe(0);
    expect(release.playbackRate).toBe(1);
    expect((release as unknown as { startTime?: number }).startTime).toBeUndefined();
  });

  it("continues the author's curve from where the finger left it", () => {
    // The rest of a cubic-bezier is a cubic-bezier, so the release carries the
    // same deceleration the whole transition would have run from that pose.
    const CURVE: [number, number, number, number] = [0.32, 0.72, 0, 1];
    const swipe = beginRiderSwipe([{ element, motion: motion({ ease: CURVE }) }]);
    swipe!.scrub(0.5);
    showPose({ opacity: "0.5" });

    swipe!.settle(true, 0.2);

    const easing = animations[1]!.options.easing as string;
    const points = /cubic-bezier\(([^)]+)\)/.exec(easing)![1]!.split(",").map(Number) as [
      number,
      number,
      number,
      number
    ];
    // The curve that is left, sampled, lands where the whole curve does: at
    // every point of the remaining clock, the same share of the remaining
    // travel as the authored curve covers over the same stretch of its own.
    const whole = resolveEasing(CURVE);
    const rest = resolveEasing(points);
    const start = invertEasing(CURVE)(0.5);
    for (const v of [0.1, 0.3, 0.6, 0.9]) {
      const original = whole(start + v * (1 - start));
      expect(0.5 + 0.5 * rest(v)).toBeCloseTo(original, 4);
    }
  });

  it("starts a linear release from camelCase and custom properties", () => {
    const swipe = beginRiderSwipe([
      {
        element,
        motion: motion({
          from: { backgroundColor: "red", "--PROGRESS": 0 },
          to: { backgroundColor: "blue", "--PROGRESS": 1 },
          ease: "linear"
        })
      }
    ]);
    swipe!.scrub(0.25);
    showPose({ "background-color": "rgb(191, 0, 64)", "--PROGRESS": "0.25" });

    swipe!.settle(true, 0.3);

    const release = animations[1]!;
    expect(release.keyframes).toEqual([
      { backgroundColor: "rgb(191, 0, 64)", "--PROGRESS": "0.25", offset: 0 },
      { backgroundColor: "blue", "--PROGRESS": "1", offset: 1 }
    ]);
    expect(release.options.easing).toBe("linear");
    expect(release.options.duration).toBe(300);
    expect(release.options.delay).toBe(0);
  });

  it("holds the drag when the curve has no travel left at the release", () => {
    // This curve reaches its arrival halfway through its clock. The screen's
    // linear phase can put the rider there before its clock has run out.
    const swipe = beginRiderSwipe([
      {
        element,
        motion: motion({ ease: [0, 4 / 3, 1, 1] }),
        phase: { side: "current", ease: "linear", duration: 0.4 }
      }
    ]);
    swipe!.scrub(0.5);
    showPose({ opacity: "1" });

    swipe!.settle(true, 0.2);

    expect(animations).toHaveLength(1);
    expect(animations[0]!.paused).toBe(true);
    expect(animations[0]!.cancelled).toBe(false);
  });

  it("keeps the whole path when the release starts outside its value interval", () => {
    const curves: [number, number, number, number][] = [
      [0, -1, 1, -1],
      [0, 2, 1, 2]
    ];
    for (const ease of curves) {
      animations.length = 0;
      const swipe = beginRiderSwipe([
        {
          element,
          motion: motion({ ease }),
          phase: { side: "current", ease: "linear", duration: 0.4 }
        }
      ]);
      swipe!.scrub(0.5);
      showPose({ opacity: "0.5" });

      swipe!.settle(true, 0.2);

      const release = animations[1]!;
      expect(release.keyframes).toEqual([{ opacity: "0" }, { opacity: "1" }]);
      expect(release.options.easing).toBe(`cubic-bezier(${ease.join(", ")})`);
      expect(release.options.duration).toBeCloseTo(400, 6);
      expect(release.options.delay).toBeCloseTo(-200, 6);
    }
  });

  it("keeps a stepped release on its whole path even when its pose can be read", () => {
    const swipe = beginRiderSwipe([{ element, motion: motion({ ease: "steps(2, end)" }) }]);
    swipe!.scrub(0.25);
    showPose({ opacity: "0.5" });

    swipe!.settle(true, 0.3);

    const release = animations[1]!;
    expect(release.keyframes).toEqual([{ opacity: "0" }, { opacity: "1" }]);
    expect(release.options.easing).toBe("steps(2, end)");
    expect(release.options.duration).toBeCloseTo(400, 6);
    expect(release.options.delay).toBeCloseTo(-100, 6);
  });

  it("keeps the whole path when the host has no computed style reader", () => {
    const swipe = beginRiderSwipe([{ element, motion: motion({ ease: "linear" }) }]);
    swipe!.scrub(0.25);
    vi.stubGlobal("getComputedStyle", undefined);

    swipe!.settle(true, 0.3);

    const release = animations[1]!;
    expect(release.keyframes).toEqual([{ opacity: "0" }, { opacity: "1" }]);
    expect(release.options.duration).toBeCloseTo(400, 6);
    expect(release.options.delay).toBeCloseTo(-100, 6);
  });

  it("falls back to the whole path, born part of the way in, when no pose can be read", () => {
    // A host that reports no computed value has nothing to start a release
    // from, and a `steps()` curve has no handles to split. Both are handed the
    // whole path with a negative delay instead: still born, still unwritten.
    const swipe = beginRiderSwipe([{ element, motion: motion({ ease: "linear" }) }]);
    swipe!.scrub(0.25);
    showPose({});

    swipe!.settle(true, 0.3);

    const release = animations[1]!;
    expect(release.keyframes.map((frame) => frame.opacity)).toEqual(["0", "1"]);
    // Three quarters of a 400ms path left, covered in 300ms: the path runs at
    // 400ms and starts a quarter of the way in.
    expect(release.options.duration).toBeCloseTo(400, 6);
    expect(release.options.delay).toBeCloseTo(-100, 6);
  });

  describe("the release is the only animation left", () => {
    // The drag animation (paused, `fill: both`) stayed on the element under
    // whatever played the release. Blink would not composite a release beside
    // it and stepped it by whole pixels; WebKit kept drawing the paused drag
    // pose, so the dim and the header Parts froze for the whole release and
    // cut at COMPLETED. Both were measured off the glass.
    it("lets go of the drag in the same task the release is born", () => {
      const swipe = beginRiderSwipe([{ element, motion: motion() }])!;
      const [drag] = animations;
      swipe.scrub(0.5);
      showPose({ opacity: "0.5" });

      swipe.settle(false, 0.2);

      expect(drag!.cancelled).toBe(true);
      expect(animations[1]!.cancelled).toBe(false);
    });

    it("keeps the drag holding the pose when there is nothing left to move", () => {
      // Nothing left to move: the drag animation is what holds the pose until
      // the landing hands the element back, so it must not be let go early.
      const swipe = beginRiderSwipe([{ element, motion: motion() }])!;
      swipe.scrub(0);

      swipe.settle(false, 0.2);

      expect(animations).toHaveLength(1);
      expect(animations[0]!.cancelled).toBe(false);
      expect(animations[0]!.paused).toBe(true);
    });
  });

  it("lands once, whether the finish or the backstop gets there first", () => {
    // Both are wired on purpose: an animation torn down before it finishes
    // fires nothing, and a caller waiting on the landing must not wait for
    // ever. Whichever arrives second must not hand the element back twice.
    vi.useFakeTimers();
    try {
      const swipe = beginRiderSwipe([{ element, motion: motion() }]);
      swipe!.scrub(0.5);
      showPose({ opacity: "0.5" });
      swipe!.settle(false, 0.2);

      animations[1]!.listeners.finish?.forEach((fn) => fn());
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
// authored. A transition cancels nothing, so a drag and the pop it walks were two
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
   * Where a screen on `CUPERTINO` is in its own transition, in seconds, when it is
   * `p` across.
   *
   * Computed here rather than read back off the animation: an expectation taken
   * from the thing under test moves with it, and the first draft of these
   * passed against the arithmetic they were written to rule out.
   */
  const transitionSeconds = (p: number, duration = 0.4) => invertEasing(CUPERTINO)(p) * duration;

  it("puts a rider at the transition time its screen is at, not at the gesture's", () => {
    const swipe = beginRiderSwipe([
      { element, motion: motion({ ease: "linear" }), phase: screen() }
    ]);

    swipe!.scrub(0.5);

    // Cupertino's curve is half travelled about a sixth of the way through its
    // clock, so a screen half-way across is a transition barely started and the
    // chrome on it has barely moved. Seeked through its OWN linear curve this
    // rider would have been at 0.5.
    expect(timeFraction(0)).toBeCloseTo(transitionSeconds(0.5) / 0.4, 5);
    expect(timeFraction(0)).toBeLessThan(0.25);
  });

  // THE SCREEN'S PROGRESS IS A FRACTION OF THE SCREEN'S CLOCK, NOT OF THIS ONE.
  //
  // The playground's `detail-chrome` runs 0.16s against cupertino's 0.7s, so
  // the seconds a screen position stands for cover four times as much of the
  // part's travel. Reading the screen's fraction as if it were the part's put
  // that header at 3% of its travel where the transition has it at 49%, which is
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
    const seconds = transitionSeconds(0.5);
    expect(timeFraction(0, 100)).toBeCloseTo(seconds / 0.1, 5);
    expect(timeFraction(0, 100)).toBeGreaterThan(0.5);
  });

  it("holds a rider that finishes before the drag does", () => {
    // Its own clock runs out inside the transition, which is what the pop does too:
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
    // Which, after `resolvePartTiming`, is every part that does not name one.
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
    expect(timeFraction(1)).toBeCloseTo(0.25, 5);
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

  // Read off the fallback (no pose to read), whose negative delay IS the time a
  // release starts from: a split release states the same time only through its
  // curve.
  const startedAt = (index: number) =>
    -(animations[index]!.options.delay as number) / (animations[index]!.options.duration as number);

  it("continues the commit from the time the finger left, not from the gesture's", () => {
    const swipe = beginRiderSwipe([
      { element, motion: motion({ ease: "linear" }), phase: screen() }
    ]);
    swipe!.scrub(0.5);
    showPose({});

    swipe!.settle(true, 0.2);

    // The commit is the same path forward, so it picks up at the transition
    // time the drag left. Starting it at the gesture's 0.5 instead would jump
    // the chrome the moment the finger lifts.
    expect(startedAt(1)).toBeCloseTo(transitionSeconds(0.5) / 0.4, 5);
    expect(startedAt(1)).not.toBeCloseTo(0.5, 2);
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
    showPose({});

    swipe!.settle(false, 0.2);

    expect(startedAt(1)).toBeCloseTo(1 - transitionSeconds(0.5) / 0.4, 5);
    expect(startedAt(1)).not.toBeCloseTo(0.5, 2);
  });
});

// A DRAG HOLDS EVERY FRAME AT A FRACTION OF A PIXEL, AND A TRANSITION DOES NOT.
//
// Each seek is a static pose, resampled wherever it lands, and the fraction
// changes unevenly because the finger does. The covered screen, creeping at its
// parallax, read that as sizzle on an iPad Pro.
describe("a slide under the finger sits on whole device pixels", () => {
  const SLIDE = motion({ from: { x: "-30%" }, to: { x: 0 }, ease: "linear" });

  /** Lay the element out: `left` untranslated, `width` wide, showing `shown` px of slide. */
  const layOut = (left: number, width: number, shown: () => number) => {
    element.getBoundingClientRect = () =>
      ({ left: left + shown(), top: 0, width, height: 100 }) as DOMRect;
  };

  /** The slide's pose on screen for the time the scrub wrote, in CSS px. */
  const placed = (width = 400) => {
    const fraction = (animations[0]!.currentTime ?? 0) / 400;
    return -0.3 * width * (1 - fraction);
  };

  it("lands each scrub on the device grid", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    layOut(10.25, 400, () => placed());
    const swipe = beginRiderSwipe([{ element, motion: SLIDE }]);

    for (const progress of [0.13, 0.37, 0.52, 0.81]) {
      swipe!.scrub(progress);
      const onScreen = 10.25 + placed();
      expect(Math.abs(onScreen * 2 - Math.round(onScreen * 2))).toBeLessThan(1e-6);
      // And never more than half a device pixel from where the finger put it.
      expect(Math.abs(placed() - -120 * (1 - progress))).toBeLessThanOrEqual(0.25 + 1e-6);
    }
  });

  it("lines up a vertical slide using its height and top edge", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    const placedY = () => -50 + 100 * ((animations[0]!.currentTime ?? 0) / 400);
    element.getBoundingClientRect = () =>
      ({ left: 99.125, top: 20.25 + placedY(), width: 400, height: 200 }) as DOMRect;
    const swipe = beginRiderSwipe([
      { element, motion: motion({ from: { y: "-25%" }, to: { y: "25%" }, ease: "linear" }) }
    ]);

    for (const progress of [0.13, 0.37, 0.52, 0.81]) {
      swipe!.scrub(progress);
      const onScreen = 20.25 + placedY();
      expect(Math.abs(onScreen * 2 - Math.round(onScreen * 2))).toBeLessThan(1e-6);
      expect(Math.abs(placedY() - (-50 + 100 * progress))).toBeLessThanOrEqual(0.25 + 1e-6);
    }
  });

  it("treats an omitted endpoint or axis value as zero translation", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    const paths = [
      { from: undefined as never, to: { x: " 40px " }, start: 0, end: 40 },
      { from: { x: "-40px" }, to: undefined as never, start: -40, end: 0 },
      { from: { opacity: 0 }, to: { opacity: 1, x: "40" }, start: 0, end: 40 },
      { from: { opacity: 0, x: "-40" }, to: { opacity: 1 }, start: -40, end: 0 }
    ];
    for (const { from, to, start, end } of paths) {
      animations.length = 0;
      const placedX = () => start + (end - start) * ((animations[0]!.currentTime ?? 0) / 400);
      layOut(10.25, 400, placedX);
      const swipe = beginRiderSwipe([{ element, motion: motion({ from, to, ease: "linear" }) }]);

      swipe!.scrub(0.37);

      const onScreen = 10.25 + placedX();
      expect(Math.abs(onScreen * 2 - Math.round(onScreen * 2))).toBeLessThan(1e-6);
      expect(Math.abs(placedX() - (start + (end - start) * 0.37))).toBeLessThanOrEqual(0.25 + 1e-6);
    }
  });

  it("leaves unmeasurable lengths on their authored clock", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    layOut(10.25, 400, () => 0);
    // Invalid runtime values can arrive from JavaScript callers. Other CSS
    // units are valid poses, but cannot be lined up as pixels or percentages.
    for (const value of [Infinity, -Infinity, NaN, false, {}, "1rem", "calc(100% - 1px)"]) {
      for (const invalidFrom of [true, false]) {
        animations.length = 0;
        const swipe = beginRiderSwipe([
          {
            element,
            motion: motion({
              from: { x: invalidFrom ? (value as never) : -40 },
              to: { x: invalidFrom ? 0 : (value as never) },
              ease: "linear"
            })
          }
        ]);

        swipe!.scrub(0.37);

        expect(animations[0]!.currentTime).toBeCloseTo(0.37 * 400, 6);
      }
    }
  });

  it("leaves a single scale on its authored clock", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    layOut(10.25, 400, () => 0);
    const swipe = beginRiderSwipe([
      { element, motion: motion({ from: { scale: 0.9 }, to: { scale: 1 }, ease: "linear" }) }
    ]);

    swipe!.scrub(0.37);

    expect(animations[0]!.currentTime).toBeCloseTo(0.37 * 400, 6);
  });

  it("leaves a slide with no distance on its authored clock", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    layOut(10.25, 400, () => -40);
    const swipe = beginRiderSwipe([
      { element, motion: motion({ from: { x: -40 }, to: { x: -40 }, ease: "linear" }) }
    ]);

    swipe!.scrub(0.37);

    expect(animations[0]!.currentTime).toBeCloseTo(0.37 * 400, 6);
  });

  it("uses CSS pixels when the device ratio is missing or not positive", () => {
    for (const ratio of [undefined, 0, -2]) {
      animations.length = 0;
      vi.stubGlobal("devicePixelRatio", ratio);
      layOut(10.25, 400, () => placed());
      const swipe = beginRiderSwipe([{ element, motion: SLIDE }]);

      swipe!.scrub(0.37);

      const onScreen = 10.25 + placed();
      expect(Math.abs(onScreen - Math.round(onScreen))).toBeLessThan(1e-6);
      expect(Math.abs(placed() - -120 * (1 - 0.37))).toBeLessThanOrEqual(0.5 + 1e-6);
    }
  });

  it("keeps a rounded pose inside both ends of a subpixel slide", () => {
    vi.stubGlobal("devicePixelRatio", 1);
    const slide = motion({ from: { x: 0 }, to: { x: 0.2 }, ease: "linear" });

    // Rounding 0.1 down would go before the start; rounding 0.6 up would go
    // past the end. Neither is a pose on this slide.
    layOut(0.1, 400, () => 0.2 * ((animations[0]!.currentTime ?? 0) / 400));
    const start = beginRiderSwipe([{ element, motion: slide }]);
    start!.scrub(0);
    expect(animations[0]!.currentTime).toBe(0);
    showPose({ transform: "none" });
    start!.settle(true, 0.2);
    expect(animations[1]!.keyframes).toEqual([
      { transform: "none", offset: 0 },
      { transform: "translate3d(0.2px, 0, 0)", offset: 1 }
    ]);
    expect(animations[1]!.options.delay).toBe(0);

    animations.length = 0;
    layOut(0.4, 400, () => 0.2 * ((animations[0]!.currentTime ?? 0) / 400));
    const end = beginRiderSwipe([{ element, motion: slide }]);
    end!.scrub(1);
    expect(animations[0]!.currentTime).toBeCloseTo(399.9, 5);
    showPose({ transform: "translate3d(0.2px, 0, 0)" });
    end!.settle(false, 0.2);
    expect(animations[1]!.keyframes).toEqual([
      { transform: "translate3d(0.2px, 0, 0)", offset: 0 },
      { transform: "none", offset: 1 }
    ]);
    expect(animations[1]!.options.delay).toBe(0);
  });

  it("leaves a rider alone until it can be measured", () => {
    // A covered screen the drag is still waking is `display: none`.
    vi.stubGlobal("devicePixelRatio", 2);
    element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 }) as DOMRect;
    const swipe = beginRiderSwipe([{ element, motion: SLIDE }]);

    swipe!.scrub(0.37);

    expect(animations[0]!.currentTime).toBeCloseTo(0.37 * 400, 6);
  });

  it("leaves a scale, a second axis and a drag with stops alone", () => {
    // None of them lines up by moving time: a scale puts its content off the
    // grid whatever the translation is, and a drag with stops does not map one
    // time to one place.
    vi.stubGlobal("devicePixelRatio", 2);
    layOut(10.25, 400, () => 0);
    for (const declared of [
      motion({ from: { x: "-30%", scale: 0.9 }, to: { x: 0, scale: 1 }, ease: "linear" }),
      motion({ from: { x: -40, y: 10 }, to: { x: 0, y: 0 }, ease: "linear" }),
      motion({
        from: { x: -40 },
        to: { x: 0 },
        via: [{ at: 0.5, value: { x: -10 } }],
        ease: "linear"
      })
    ]) {
      animations.length = 0;
      const swipe = beginRiderSwipe([{ element, motion: declared }]);
      swipe!.scrub(0.37);
      expect(animations[0]!.currentTime).toBeCloseTo(0.37 * 400, 6);
    }
  });
});
