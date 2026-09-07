import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VariantMotion } from "@transition/variantMotion";

import { beginRiderSwipe } from "@core/engine/riderSwipe";

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

    // The ends still land exactly on the ends.
    swipe!.scrub(0);
    expect(animations[0]!.currentTime).toBe(0);
    swipe!.scrub(1);
    expect(animations[0]!.currentTime).toBe(400);
  });

  it("clamps a drag that runs past either end", () => {
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);

    swipe!.scrub(-1);
    expect(animations[0]!.currentTime).toBe(0);
    swipe!.scrub(2);
    expect(animations[0]!.currentTime).toBe(400);
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

  it("drives nothing for a rider with no motion to run", () => {
    expect(beginRiderSwipe([{ element, motion: motion({ duration: 0 }) }])).toBeNull();
    expect(beginRiderSwipe([])).toBeNull();
    expect(animations).toHaveLength(0);
  });
});
