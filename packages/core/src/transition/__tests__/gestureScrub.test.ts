import { describe, expect, it, vi } from "vitest";

import {
  holdScrubAt,
  placeLeg,
  returnLegSeek,
  scrubTo,
  settleScrubbed,
  stageReturnLeg
} from "@transition/gestureScrub";

// A stand-in for the browser's own `Animation`, because the release is
// arithmetic on `startTime` and `playbackRate` and jsdom ships neither.
const fakeAnimation = (options?: { currentTime?: number; timeline?: number | null }) => {
  const timeline = options?.timeline === undefined ? 1_000 : options.timeline;
  return {
    currentTime: options?.currentTime ?? 0,
    startTime: null as number | null,
    playbackRate: 1,
    paused: false,
    played: 0,
    timeline: timeline === null ? null : { currentTime: timeline },
    pause() {
      this.paused = true;
    },
    play() {
      this.played += 1;
      this.paused = false;
    },
    addEventListener() {}
  };
};

type FakeAnimation = ReturnType<typeof fakeAnimation>;

const asAnimations = (animations: FakeAnimation[]) => animations as unknown as Animation[];

const clock = { start: 0.1, duration: 0.5, ease: "linear" as const };

describe("holdScrubAt", () => {
  it("pauses first so nothing advances between the seek and the next move", () => {
    const animation = fakeAnimation();
    const order: string[] = [];
    animation.pause = () => order.push("pause");
    Object.defineProperty(animation, "currentTime", {
      set() {
        order.push("seek");
      },
      get: () => 0,
      configurable: true
    });

    holdScrubAt(asAnimations([animation]), 0.2);

    expect(order).toEqual(["pause", "seek"]);
  });

  it("survives an animation whose timeline refuses the seek", () => {
    const animation = fakeAnimation();
    Object.defineProperty(animation, "currentTime", {
      set() {
        throw new Error("no resolved timeline");
      },
      get: () => 0,
      configurable: true
    });

    expect(() => holdScrubAt(asAnimations([animation]), 0.2)).not.toThrow();
  });
});

describe("scrubTo", () => {
  it("moves to a fraction of the travel, past the flight's own start offset", () => {
    const animation = fakeAnimation();

    scrubTo(asAnimations([animation]), clock, 0.5);

    // start 0.1s + half of 0.5s, in milliseconds.
    expect(animation.currentTime).toBeCloseTo(350, 5);
  });

  it("clamps a finger that ran past either end", () => {
    const under = fakeAnimation();
    const over = fakeAnimation();

    scrubTo(asAnimations([under]), clock, -2);
    scrubTo(asAnimations([over]), clock, 4);

    expect(under.currentTime).toBeCloseTo(100, 5);
    expect(over.currentTime).toBeCloseTo(600, 5);
  });
});

// THE RELEASE PLACES THE ANIMATION RATHER THAN PLAYING IT.
//
// `play()` leaves the animation play-pending and lets the next frame decide
// what time it resumes at; WebKit resolves that against the animation's own
// origin rather than the release, which put the whole drag's worth of clock
// into one frame. Writing `startTime` is the same resume with no frame in
// between to disagree about.
describe("settleScrubbed", () => {
  it("places a committed flight at the time the finger left it", () => {
    const animation = fakeAnimation({ currentTime: 200 });

    settleScrubbed(asAnimations([animation]), clock, true, 0.4);

    // 400ms of travel left over a 0.4s release.
    expect(animation.playbackRate).toBeCloseTo(1, 5);
    expect(animation.startTime).toBeCloseTo(800, 5);
    expect(animation.played).toBe(0);
    // currentTime = (timeline - startTime) * playbackRate
    expect((1_000 - (animation.startTime ?? 0)) * animation.playbackRate).toBeCloseTo(200, 5);
  });

  it("runs a cancelled flight backwards from where it was held", () => {
    const animation = fakeAnimation({ currentTime: 200 });
    const onReverseFinish = vi.fn();

    settleScrubbed(asAnimations([animation]), clock, false, 0.2, onReverseFinish);

    // 200ms back over a 0.2s release, and the direction is the sign.
    expect(animation.playbackRate).toBeCloseTo(-1, 5);
    expect((1_000 - (animation.startTime ?? 0)) * animation.playbackRate).toBeCloseTo(200, 5);
  });

  it("subscribes the reverse hook, because backwards fires no animationend", () => {
    const animation = fakeAnimation({ currentTime: 200 });
    const onReverseFinish = vi.fn();
    const addEventListener = vi.fn();
    animation.addEventListener = addEventListener;

    settleScrubbed(asAnimations([animation]), clock, false, 0.2, onReverseFinish);

    expect(addEventListener).toHaveBeenCalledWith("finish", onReverseFinish, { once: true });
  });

  it("takes the rate from the whole flight's clock, not each passenger's", () => {
    // A cut that finished long before the release rides the same clock as the
    // travel it belongs to, so both land together.
    const travel = fakeAnimation({ currentTime: 200 });
    const cut = fakeAnimation({ currentTime: 200 });

    settleScrubbed(asAnimations([travel, cut]), clock, true, 0.2);

    expect(cut.playbackRate).toBeCloseTo(travel.playbackRate, 5);
    expect(cut.startTime).toBeCloseTo(travel.startTime ?? 0, 5);
  });

  it("falls back to the play when there is no timeline to solve against", () => {
    const animation = fakeAnimation({ currentTime: 200, timeline: null });

    settleScrubbed(asAnimations([animation]), clock, true, 0.4);

    expect(animation.played).toBe(1);
  });

  it("falls back to the play when the timeline refuses the write", () => {
    const animation = fakeAnimation({ currentTime: 200 });
    Object.defineProperty(animation, "startTime", {
      set() {
        throw new Error("not animatable");
      },
      get: () => null,
      configurable: true
    });

    settleScrubbed(asAnimations([animation]), clock, true, 0.4);

    expect(animation.played).toBe(1);
  });

  it("never divides by a release shorter than a frame", () => {
    const animation = fakeAnimation({ currentTime: 200 });

    settleScrubbed(asAnimations([animation]), clock, true, 0);

    expect(Number.isFinite(animation.startTime ?? NaN)).toBe(true);
    expect(animation.playbackRate).toBeCloseTo(0.4 / (1 / 60), 5);
  });
});

// `currentTime` and `startTime` are `CSSNumberish`: a plain number on every
// engine that ships this, and a `CSSNumericValue` under the scroll-timeline
// proposals. The release reads whichever it is given.
describe("a timeline that answers in CSSNumericValue", () => {
  const numeric = (value: unknown) => ({ value }) as unknown as number;

  it("reads the number off the unit value", () => {
    const animation = fakeAnimation({ currentTime: numeric(200) });

    settleScrubbed(asAnimations([animation]), clock, true, 0.4);

    expect(animation.playbackRate).toBeCloseTo(1, 5);
    expect((1_000 - (animation.startTime ?? 0)) * animation.playbackRate).toBeCloseTo(200, 5);
  });

  it("treats a value it cannot read as the start of the flight", () => {
    // A sum or a product has no single number to read, and a release that
    // cannot place the animation must not place it at NaN.
    const animation = fakeAnimation({ currentTime: numeric("nope") });

    settleScrubbed(asAnimations([animation]), clock, true, 0.4);

    expect(Number.isFinite(animation.startTime ?? NaN)).toBe(true);
  });
});

// THE RETURN A CANCEL RUNS.
//
// A morph's motion is a compiled `@keyframes`, so the only place its
// declaration can be read back is the animation itself. These cover the read,
// the reversal, and the seek that puts the leg at the pose already on screen.
const CUPERTINO = "cubic-bezier(0.32, 0.72, 0, 1)";

interface FakeLeg {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  currentTime: number | null;
  startTime: number | null;
  playbackRate: number;
  paused: boolean;
  cancelled: boolean;
  played: number;
  timeline: { currentTime: number } | null;
  effect: { getKeyframes: () => Keyframe[] } | null;
  pause: () => void;
  play: () => void;
  cancel: () => void;
}

const stageTarget = (
  options: { drops?: string; refusesSeek?: boolean; blindEffect?: boolean } = {}
) => {
  const element = document.createElement("div");
  const legs: FakeLeg[] = [];
  element.animate = ((keyframes: Keyframe[], animationOptions: KeyframeAnimationOptions) => {
    const leg: FakeLeg = {
      keyframes,
      options: animationOptions,
      currentTime: 0,
      startTime: null,
      playbackRate: 1,
      paused: false,
      cancelled: false,
      played: 0,
      timeline: { currentTime: 1_000 },
      effect: options.blindEffect
        ? null
        : {
            getKeyframes: () =>
              keyframes.map((frame) => {
                if (!options.drops) return frame;
                const { [options.drops]: _dropped, ...kept } = frame;
                return kept;
              })
          },
      pause() {
        this.paused = true;
      },
      play() {
        this.played += 1;
      },
      cancel() {
        this.cancelled = true;
      }
    };
    if (options.refusesSeek) {
      Object.defineProperty(leg, "currentTime", {
        set() {
          throw new Error("no resolved timeline");
        },
        get: () => 0,
        configurable: true
      });
    }
    legs.push(leg);
    return leg as unknown as Animation;
  }) as HTMLElement["animate"];
  return { element, legs };
};

const fakeSource = (input: {
  element: HTMLElement | null;
  frames: Partial<ComputedKeyframe>[];
  duration?: number | string;
  delay?: number | null;
  easing?: string | null;
  currentTime?: number | null;
  pseudoElement?: string;
  timingless?: boolean;
  keyframeless?: boolean;
}) =>
  ({
    currentTime: input.currentTime === undefined ? 0 : input.currentTime,
    timeline: { currentTime: 1_000 },
    effect: {
      target: input.element,
      pseudoElement: input.pseudoElement ?? null,
      getTiming: input.timingless
        ? undefined
        : () => ({
            duration: input.duration ?? 700,
            ...(input.delay === null ? {} : { delay: input.delay ?? 0 }),
            ...(input.easing === null ? {} : { easing: input.easing ?? "linear" })
          }),
      getKeyframes: input.keyframeless ? undefined : () => input.frames
    }
  }) as unknown as Animation;

/** A flight's shape: a flat lead-in, then the travel. */
const flightFrames = (easing = CUPERTINO) => [
  { computedOffset: 0, easing, transform: "none" },
  { computedOffset: 0.3, easing, transform: "none" },
  { computedOffset: 1, easing, transform: "translateX(100px)" }
];

describe("stageReturnLeg", () => {
  it("walks the declared path the other way, without the lead-in nobody waits through", () => {
    const { element, legs } = stageTarget();
    const leg = stageReturnLeg(fakeSource({ element, frames: flightFrames(), duration: 700 }));

    expect(leg).not.toBeNull();
    // The head is 30% of 700ms, so what is left to walk home is 490ms.
    expect(leg!.duration).toBe(490);
    expect(leg!.travel).toEqual({ start: 0, end: 490 });
    expect(legs[0]!.keyframes).toEqual([
      { offset: 0, easing: CUPERTINO, transform: "translateX(100px)" },
      { offset: 1, easing: CUPERTINO, transform: "none" }
    ]);
    // Staged and inert: seeking it into range is what makes it the motion.
    expect(legs[0]!.paused).toBe(true);
    expect(legs[0]!.currentTime).toBe(-1);
    expect(legs[0]!.options.fill).toBe("forwards");
  });

  it("mirrors a stop, so a third of the way out is two thirds of the way home", () => {
    const { element, legs } = stageTarget();
    stageReturnLeg(
      fakeSource({
        element,
        duration: 1_000,
        frames: [
          { computedOffset: 0, easing: "linear", opacity: "0" },
          { computedOffset: 0.25, easing: CUPERTINO, opacity: "0.5" },
          { computedOffset: 1, easing: "linear", opacity: "1" }
        ]
      })
    );

    expect(legs[0]!.keyframes).toEqual([
      { offset: 0, easing: CUPERTINO, opacity: "1" },
      { offset: 0.75, easing: "linear", opacity: "0.5" },
      { offset: 1, easing: "linear", opacity: "0" }
    ]);
  });

  it("declines a stepped channel, which is a handover rather than a motion", () => {
    const { element, legs } = stageTarget();

    expect(
      stageReturnLeg(
        fakeSource({
          element,
          duration: 17,
          frames: [
            { computedOffset: 0, easing: "steps(1, start)", opacity: "1" },
            { computedOffset: 1, easing: "steps(1, start)", opacity: "0" }
          ]
        })
      )
    ).toBeNull();
    expect(legs).toHaveLength(0);
  });

  it("declines a host that took the keyframes but not the property", () => {
    const { element, legs } = stageTarget({ drops: "--flemo-morph-x" });

    expect(
      stageReturnLeg(
        fakeSource({
          element,
          duration: 500,
          frames: [
            { computedOffset: 0, easing: "linear", "--flemo-morph-x": "0px" },
            { computedOffset: 1, easing: "linear", "--flemo-morph-x": "80px" }
          ] as Partial<ComputedKeyframe>[]
        })
      )
    ).toBeNull();
    // Left staged it would animate nothing, and the element would hang there.
    expect(legs[0]!.cancelled).toBe(true);
  });

  it("declines an animation that never moves", () => {
    const { element } = stageTarget();

    expect(
      stageReturnLeg(
        fakeSource({
          element,
          duration: 500,
          frames: [
            { computedOffset: 0, easing: "linear", opacity: "1" },
            { computedOffset: 1, easing: "linear", opacity: "1" }
          ]
        })
      )
    ).toBeNull();
  });
});

describe("returnLegSeek", () => {
  it("spends the release on the curve's tail, which is where the deceleration is", () => {
    const { element } = stageTarget();
    // A drag 9% across sits at 30ms of cupertino's 700 — the curve's opening,
    // which is its own tangent. Playing that back is the flat return the
    // device reported; the leg instead starts where 9% is LEFT.
    const source = fakeSource({
      element,
      frames: flightFrames(),
      duration: 700,
      currentTime: 210 + 30
    });
    const leg = stageReturnLeg(source)!;

    const seek = returnLegSeek(leg, source)!;

    expect(seek.remaining).toBeGreaterThan(0);
    // Most of the return's clock covers the last tenth of the way home.
    const share = seek.remaining / leg.duration;
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(0.8);
  });

  it("gives a linear declaration the flat return it asked for", () => {
    const { element } = stageTarget();
    const source = fakeSource({
      element,
      frames: flightFrames("linear"),
      duration: 700,
      currentTime: 210 + 0.09 * 490
    });
    const leg = stageReturnLeg(source)!;

    const seek = returnLegSeek(leg, source)!;

    expect(seek.remaining / leg.duration).toBeCloseTo(0.09, 5);
  });

  it("has nothing to fly for a drag that never left the start", () => {
    const { element } = stageTarget();
    const source = fakeSource({ element, frames: flightFrames(), duration: 700, currentTime: 0 });
    const leg = stageReturnLeg(source)!;

    expect(returnLegSeek(leg, source)).toBeNull();
  });
});

describe("placeLeg", () => {
  it("covers what is left of the leg in the seconds the release settled on", () => {
    const { element, legs } = stageTarget();
    stageReturnLeg(fakeSource({ element, frames: flightFrames(), duration: 700 }));
    const leg = legs[0]!;

    placeLeg(leg as unknown as Animation, 100, 300, 0.15);

    // 300ms of the leg's own clock inside a 150ms release.
    expect(leg.playbackRate).toBeCloseTo(2, 5);
    expect(leg.currentTime).toBe(100);
    expect(leg.startTime).toBeCloseTo(1_000 - 100 / 2, 5);
    expect(leg.played).toBe(0);
  });

  it("plays a leg with no resolved timeline to solve against", () => {
    const { element, legs } = stageTarget();
    stageReturnLeg(fakeSource({ element, frames: flightFrames(), duration: 700 }));
    const leg = legs[0]!;
    leg.timeline = null;

    placeLeg(leg as unknown as Animation, 100, 300, 0.15);

    expect(leg.played).toBe(1);
  });
});

describe("stageReturnLeg declines", () => {
  const frames = flightFrames();

  it("what it cannot read a path off", () => {
    const { element } = stageTarget();

    expect(stageReturnLeg({ effect: null } as unknown as Animation)).toBeNull();
    expect(stageReturnLeg(fakeSource({ element, frames, keyframeless: true }))).toBeNull();
    expect(stageReturnLeg(fakeSource({ element, frames, timingless: true }))).toBeNull();
  });

  it("what it cannot stage against", () => {
    const { element } = stageTarget();
    const orphan = document.createElement("div");

    expect(stageReturnLeg(fakeSource({ element: null, frames }))).toBeNull();
    // A pseudo-element's animation has no element to stage a second one on.
    expect(stageReturnLeg(fakeSource({ element, frames, pseudoElement: "::before" }))).toBeNull();
    expect(stageReturnLeg(fakeSource({ element: orphan, frames }))).toBeNull();
  });

  it("a clock it cannot solve against", () => {
    const { element } = stageTarget();

    expect(stageReturnLeg(fakeSource({ element, frames, duration: "auto" }))).toBeNull();
    expect(stageReturnLeg(fakeSource({ element, frames, duration: 0 }))).toBeNull();
  });

  it("a path with no poses in it", () => {
    const { element } = stageTarget();

    expect(stageReturnLeg(fakeSource({ element, frames: [frames[0]!] }))).toBeNull();
    // What Chromium answers a compiled animation with: the offsets, the
    // curves, and none of the properties.
    expect(
      stageReturnLeg(
        fakeSource({
          element,
          frames: [
            { computedOffset: 0, easing: CUPERTINO },
            { computedOffset: 1, easing: CUPERTINO }
          ]
        })
      )
    ).toBeNull();
  });

  it("a pose that declares what its neighbour does not", () => {
    const { element } = stageTarget();

    expect(
      stageReturnLeg(
        fakeSource({
          element,
          frames: [
            { computedOffset: 0, easing: "linear", opacity: "0" },
            { computedOffset: 1, easing: "linear", opacity: "1", transform: "none" }
          ]
        })
      )
    ).toBeNull();
  });

  it("a curve with no speed to read", () => {
    const { element } = stageTarget();
    const spring = flightFrames("spring(1 100 10 0)");

    expect(stageReturnLeg(fakeSource({ element, frames: spring }))).toBeNull();
    expect(stageReturnLeg(fakeSource({ element, frames: flightFrames("") }))).toBeNull();
    expect(
      stageReturnLeg(fakeSource({ element, frames: flightFrames("cubic-bezier(1, 2)") }))
    ).toBeNull();
  });

  it("a host that will not park the leg out of effect", () => {
    const { element, legs } = stageTarget({ refusesSeek: true });

    expect(stageReturnLeg(fakeSource({ element, frames }))).toBeNull();
    expect(legs[0]!.cancelled).toBe(true);
  });
});

describe("stageReturnLeg takes", () => {
  it("a named curve, and a clock with neither a delay nor a curve of its own", () => {
    const { element, legs } = stageTarget();

    const leg = stageReturnLeg(
      fakeSource({ element, frames: flightFrames("ease-in"), delay: null, easing: null })
    );

    expect(leg!.source.delay).toBe(0);
    expect(legs[0]!.options.easing).toBe("linear");
    expect(leg!.ease).toEqual([0.42, 0, 1, 1]);
  });

  it("a leg that reports no keyframes back, on the keys it was given", () => {
    const { element } = stageTarget({ blindEffect: true });

    expect(stageReturnLeg(fakeSource({ element, frames: flightFrames() }))).not.toBeNull();
  });

  it("a declared path, with CSS property names as a keyframe wants them", () => {
    const { element, legs } = stageTarget();

    stageReturnLeg(fakeSource({ element, frames: [], duration: 400 }), [
      { offset: 0, easing: "linear", pose: { "line-height": "12px", "--flemo-pose-x": "0px" } },
      { offset: 1, easing: "linear", pose: { "line-height": "20px", "--flemo-pose-x": "40px" } }
    ]);

    expect(legs[0]!.keyframes[0]).toEqual({
      offset: 0,
      easing: "linear",
      lineHeight: "20px",
      "--flemo-pose-x": "40px"
    });
  });
});

describe("returnLegSeek", () => {
  it("reads a source the host has not given a time yet as its own start", () => {
    const { element } = stageTarget();
    const source = fakeSource({ element, frames: flightFrames(), currentTime: null });

    expect(returnLegSeek(stageReturnLeg(source)!, source)).toBeNull();
  });

  it("has the whole way home to fly for a drag held at the far end", () => {
    const { element } = stageTarget();
    const source = fakeSource({ element, frames: flightFrames(), currentTime: 900 });
    const leg = stageReturnLeg(source)!;

    expect(returnLegSeek(leg, source)!.remaining).toBeCloseTo(leg.duration, 5);
  });
});

describe("settleScrubbed", () => {
  it("hands back nothing without reading a clock it does not have", () => {
    expect(() => settleScrubbed([], clock, true, 0.2)).not.toThrow();
  });

  it("keeps its rate for a release with nothing left to travel", () => {
    const animation = fakeAnimation({ currentTime: 0 });

    settleScrubbed(asAnimations([animation]), clock, false, 0.2);

    expect(animation.playbackRate).toBe(-1);
  });
});
