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
  it("stages a paused animation from the rider's own pose", () => {
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);

    expect(swipe).not.toBeNull();
    expect(animations).toHaveLength(1);
    expect(animations[0]!.keyframes).toEqual([{ opacity: "0" }, { opacity: "1" }]);
    expect(animations[0]!.options.duration).toBe(400);
    expect(animations[0]!.options.fill).toBe("both");
    // Held at zero: the finger owns the time from the first frame.
    expect(animations[0]!.paused).toBe(true);
    expect(animations[0]!.currentTime).toBe(0);
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
    expect(animations[0]!.played).toBe(true);
    expect(animations[0]!.playbackRate).toBeGreaterThan(0);
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

    animations[0]!.listeners.finish?.forEach((fn) => fn());

    expect(animations[0]!.cancelled).toBe(true);
    expect(element.hasAttribute(SKIP_ANIMATION_ATTR)).toBe(false);
  });

  it("runs backwards on cancel and leaves the element to its rest rule", () => {
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);
    swipe!.scrub(0.5);

    swipe!.settle(false, 0.2);

    expect(element.hasAttribute(SKIP_ANIMATION_ATTR)).toBe(false);
    expect(animations[0]!.playbackRate).toBeLessThan(0);
    // Backwards an animation finishes at its start and fires no animationend,
    // so the handback is explicit here too.
    animations[0]!.listeners.finish?.forEach((fn) => fn());
    expect(animations[0]!.cancelled).toBe(true);
  });

  it("settles once, however many times the release reports", () => {
    const swipe = beginRiderSwipe([{ element, motion: motion() }]);

    swipe!.settle(true, 0.2);
    const rate = animations[0]!.playbackRate;
    swipe!.settle(false, 0.2);

    expect(animations[0]!.playbackRate).toBe(rate);
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

  it("drives nothing for a rider with no motion to run", () => {
    expect(beginRiderSwipe([{ element, motion: motion({ duration: 0 }) }])).toBeNull();
    expect(beginRiderSwipe([])).toBeNull();
    expect(animations).toHaveLength(0);
  });
});
