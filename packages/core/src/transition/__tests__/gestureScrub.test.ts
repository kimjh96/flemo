import { describe, expect, it, vi } from "vitest";

import { holdScrubAt, scrubTo, settleScrubbed } from "@transition/gestureScrub";

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
