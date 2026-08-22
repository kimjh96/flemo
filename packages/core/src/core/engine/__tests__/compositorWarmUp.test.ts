import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import holdCompositorWarm, {
  resetCompositorWarmForTesting,
  WARM_ATTR
} from "@core/engine/compositorWarmUp";
import { reportInFlightCadence, resetSteadySixtyForTests } from "@platform/steadySixtyCadence";

const warmElement = () => document.querySelector(`[${WARM_ATTR}]`);

const stubAnimate = (impl?: () => Animation) => {
  const cancel = vi.fn();
  const animate = vi.fn(
    impl ?? (() => ({ cancel }) as unknown as Animation)
  ) as unknown as typeof Element.prototype.animate;
  Element.prototype.animate = animate;
  return { animate: animate as unknown as ReturnType<typeof vi.fn>, cancel };
};

const originalAnimate = Element.prototype.animate;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
  Element.prototype.animate = originalAnimate;
  document.body.innerHTML = "";
});

describe("holdCompositorWarm", () => {
  it("mounts one inert animating element for the length of a hold", () => {
    const { animate } = stubAnimate();

    const release = holdCompositorWarm();

    const element = warmElement();
    expect(element).not.toBeNull();
    expect(element?.getAttribute("aria-hidden")).toBe("true");
    // Invisible and inert: it must never take a hit or affect layout.
    expect(element?.getAttribute("style")).toContain("pointer-events:none");
    expect(element?.getAttribute("style")).toContain("position:fixed");
    expect(animate).toHaveBeenCalledTimes(1);

    release();
    expect(warmElement()).toBeNull();
  });

  it("reference-counts concurrent holds and cancels the animation once", () => {
    const { animate, cancel } = stubAnimate();

    const first = holdCompositorWarm();
    const second = holdCompositorWarm();

    // One element, one animation, however many screens are in flight.
    expect(animate).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(`[${WARM_ATTR}]`)).toHaveLength(1);

    first();
    expect(warmElement()).not.toBeNull();

    second();
    expect(warmElement()).toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("is idempotent per hold, so a double release cannot drop another's hold", () => {
    stubAnimate();

    const first = holdCompositorWarm();
    const second = holdCompositorWarm();

    first();
    first();

    expect(warmElement()).not.toBeNull();

    second();
    expect(warmElement()).toBeNull();
  });

  it("removes itself on the backstop when a flight never reports its end", () => {
    stubAnimate();

    holdCompositorWarm();
    expect(warmElement()).not.toBeNull();

    vi.advanceTimersByTime(3000);

    expect(warmElement()).toBeNull();
  });

  it("does not double-decrement when a release lands after its backstop", () => {
    stubAnimate();

    const stale = holdCompositorWarm();
    vi.advanceTimersByTime(3000);
    expect(warmElement()).toBeNull();

    const live = holdCompositorWarm();
    // The timed-out hold is already released; calling it must not tear down
    // the flight that started afterwards.
    stale();

    expect(warmElement()).not.toBeNull();
    live();
    expect(warmElement()).toBeNull();
  });

  it("keeps the element when the engine refuses the effect", () => {
    stubAnimate(() => {
      throw new Error("unsupported");
    });

    const release = holdCompositorWarm();

    expect(warmElement()).not.toBeNull();
    release();
    expect(warmElement()).toBeNull();
  });

  it("does nothing where animations are unavailable", () => {
    // @ts-expect-error - modelling an engine without WAAPI
    Element.prototype.animate = undefined;

    const release = holdCompositorWarm();

    expect(warmElement()).toBeNull();
    expect(() => release()).not.toThrow();
  });
});

describe("holdCompositorWarm release edges", () => {
  it("a second release of the same hold is a no-op", () => {
    stubAnimate();
    const release = holdCompositorWarm();
    release();
    expect(warmElement()).toBeNull();
    release(); // must not underflow holders or touch a future element
    const again = holdCompositorWarm();
    expect(warmElement()).not.toBeNull();
    again();
  });

  it("releasing one of two holds keeps the element alive", () => {
    stubAnimate();
    const first = holdCompositorWarm();
    const second = holdCompositorWarm();
    first();
    expect(warmElement()).not.toBeNull();
    second();
    expect(warmElement()).toBeNull();
  });
});

describe("holdCompositorWarm backstop", () => {
  it("drains a hold whose flight never reported its end", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      stubAnimate();
      const release = holdCompositorWarm();
      expect(warmElement()).not.toBeNull();
      vi.advanceTimersByTime(3001);
      expect(warmElement()).toBeNull();
      // The real release arriving after the backstop is a no-op.
      release();
      expect(warmElement()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("holdCompositorWarm backstop with siblings", () => {
  it("one drained backstop leaves a sibling hold's element alive", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      stubAnimate();
      holdCompositorWarm(); // never released: its backstop drains it
      vi.advanceTimersByTime(1500);
      const late = holdCompositorWarm();
      vi.advanceTimersByTime(1600); // first backstop fires; late hold remains
      expect(warmElement()).not.toBeNull();
      late();
      expect(warmElement()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

// The viz-level cadence lock: on steady-60 desktops the warm-up also mounts a
// session-persistent 8x8 60fps video, because only a VIDEO surface reaches
// viz's own compositing cadence (see WARM_VIDEO_SRC). Everything about it is
// best-effort — an engine without webm or autoplay keeps the element-only
// warm-up — so every failure path here must stay silent.
describe("holdCompositorWarm cadence video", () => {
  const warmVideo = () => document.querySelector<HTMLVideoElement>("[data-flemo-warm-video]");
  let play: ReturnType<typeof vi.fn>;
  let pause: ReturnType<typeof vi.fn>;
  let originalDpr: number;
  const NAV = navigator as { userAgentData?: unknown };

  const eligible = () => {
    // steadySixtyDesktopProfile(): a verified steady-60 verdict on a
    // non-touch Blink session at HiDPI.
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);
    NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });
  };

  beforeEach(() => {
    resetCompositorWarmForTesting();
    resetSteadySixtyForTests();
    originalDpr = window.devicePixelRatio;
    // jsdom implements neither play nor pause on HTMLMediaElement.
    play = vi.fn(() => Promise.resolve());
    pause = vi.fn();
    HTMLMediaElement.prototype.play = play as unknown as () => Promise<void>;
    HTMLMediaElement.prototype.pause = pause as unknown as () => void;
  });

  afterEach(() => {
    resetCompositorWarmForTesting();
    resetSteadySixtyForTests();
    delete NAV.userAgentData;
    delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
    Object.defineProperty(window, "devicePixelRatio", { value: originalDpr, configurable: true });
  });

  it("mounts one muted, inert, looping video on a steady-60 desktop", () => {
    stubAnimate();
    eligible();

    const release = holdCompositorWarm();

    const video = warmVideo();
    expect(video).not.toBeNull();
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.playsInline).toBe(true);
    expect(video?.getAttribute("aria-hidden")).toBe("true");
    expect(video?.getAttribute("style")).toContain("pointer-events:none");
    expect(video?.src.startsWith("data:video/webm;base64,")).toBe(true);
    expect(play).toHaveBeenCalled();
    // NOT the warm element's own attribute: the video is an internal
    // auxiliary, and the element remains the warm-up's public contract.
    expect(video?.hasAttribute(WARM_ATTR)).toBe(false);

    release();
    // Session-persistent: the release tears the element down, never the video.
    expect(warmElement()).toBeNull();
    expect(warmVideo()).not.toBeNull();
  });

  it("keeps the one video across holds", () => {
    stubAnimate();
    eligible();

    holdCompositorWarm()();
    holdCompositorWarm()();

    expect(document.querySelectorAll("[data-flemo-warm-video]")).toHaveLength(1);
  });

  it("pauses while the document is hidden and resumes when it returns", () => {
    stubAnimate();
    eligible();
    holdCompositorWarm();
    play.mockClear();

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(pause).toHaveBeenCalledTimes(1);
    expect(play).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("survives an engine whose play() returns nothing", () => {
    stubAnimate();
    eligible();
    HTMLMediaElement.prototype.play = vi.fn(() => undefined) as unknown as () => Promise<void>;

    expect(() => holdCompositorWarm()()).not.toThrow();
    expect(warmVideo()).not.toBeNull();
  });

  it("skips the video entirely off the steady-60 desktop profile", () => {
    stubAnimate();
    // Verdict verified, but a 1x display is outside the profile.
    reportInFlightCadence(16.7);
    reportInFlightCadence(16.7);
    NAV.userAgentData = { brands: [{ brand: "Chromium", version: "120" }] };
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });

    holdCompositorWarm()();

    expect(warmVideo()).toBeNull();
  });

  it("keeps the element-only warm-up when the video cannot be created", () => {
    stubAnimate();
    eligible();
    const createElement = document.createElement.bind(document);
    const spy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
        if (tagName === "video") throw new Error("no media element");
        return createElement(tagName, options);
      });

    expect(() => holdCompositorWarm()).not.toThrow();
    expect(warmVideo()).toBeNull();
    expect(warmElement()).not.toBeNull();

    spy.mockRestore();
  });
});
