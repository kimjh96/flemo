import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import holdCompositorWarm, {
  resetCompositorWarmForTesting,
  WARM_ATTR
} from "@core/engine/compositorWarmUp";

const warmElement = () => document.querySelector(`[${WARM_ATTR}]`);
/** Forcing frames right now, as opposed to resident and idle. */
const warmIsOn = () => warmElement()?.getAttribute(WARM_ATTR) === "on";

const stubAnimate = (impl?: () => Animation) => {
  const cancel = vi.fn();
  const pause = vi.fn();
  const play = vi.fn();
  const animate = vi.fn(
    impl ?? (() => ({ cancel, pause, play }) as unknown as Animation)
  ) as unknown as typeof Element.prototype.animate;
  Element.prototype.animate = animate;
  return { animate: animate as unknown as ReturnType<typeof vi.fn>, cancel, pause, play };
};

const originalAnimate = Element.prototype.animate;

beforeEach(() => {
  vi.useFakeTimers();
  resetCompositorWarmForTesting();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
  Element.prototype.animate = originalAnimate;
  resetCompositorWarmForTesting();
  document.body.innerHTML = "";
});

describe("holdCompositorWarm", () => {
  it("mounts one inert animating element for the length of a hold", () => {
    const { animate, pause } = stubAnimate();

    const release = holdCompositorWarm();

    const element = warmElement();
    expect(element).not.toBeNull();
    expect(element?.getAttribute("aria-hidden")).toBe("true");
    // Invisible and inert: it must never take a hit or affect layout.
    expect(element?.getAttribute("style")).toContain("pointer-events:none");
    expect(element?.getAttribute("style")).toContain("position:fixed");
    // The opacity a consumer reported SEEING at 0.02 (2026-08-31, iPhone): a
    // regression here is a visible artifact on someone's app, so it is pinned.
    expect(element?.getAttribute("style")).toContain("opacity:0.006");
    expect(animate).toHaveBeenCalledTimes(1);
    expect(warmIsOn()).toBe(true);

    release();
    // RESIDENT: the release stops the frame forcing, it does not remove the
    // element. A per-tap create/remove cycle is DOM churn on the navigating
    // path, and it re-introduced the patch as a pop-in every time.
    expect(warmElement()).not.toBeNull();
    expect(warmIsOn()).toBe(false);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("reference-counts concurrent holds and animates once", () => {
    const { animate, pause, play } = stubAnimate();

    const first = holdCompositorWarm();
    const second = holdCompositorWarm();

    // One element, one animation, however many screens are in flight.
    expect(animate).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(`[${WARM_ATTR}]`)).toHaveLength(1);

    first();
    expect(warmIsOn()).toBe(true);
    expect(pause).not.toHaveBeenCalled();

    second();
    expect(warmIsOn()).toBe(false);
    expect(pause).toHaveBeenCalledTimes(1);

    // The next flight resumes the resident animation instead of building a
    // second element.
    holdCompositorWarm();
    expect(animate).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    expect(warmIsOn()).toBe(true);
  });

  it("is idempotent per hold, so a double release cannot drop another's hold", () => {
    stubAnimate();

    const first = holdCompositorWarm();
    const second = holdCompositorWarm();

    first();
    first();

    expect(warmIsOn()).toBe(true);

    second();
    expect(warmIsOn()).toBe(false);
  });

  it("rebuilds when something has carried the resident element away", () => {
    const { animate } = stubAnimate();

    holdCompositorWarm()();
    // Anything that replaces the body's contents detaches it; a module slot
    // left pointing at the detached node would report a live warm-up forever
    // while forcing no frames at all.
    document.body.innerHTML = "";

    holdCompositorWarm();
    expect(warmElement()).not.toBeNull();
    expect(warmIsOn()).toBe(true);
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it("idles on the backstop when a flight never reports its end", () => {
    stubAnimate();

    holdCompositorWarm();
    expect(warmIsOn()).toBe(true);

    vi.advanceTimersByTime(3000);

    expect(warmIsOn()).toBe(false);
  });

  it("does not double-decrement when a release lands after its backstop", () => {
    stubAnimate();

    const stale = holdCompositorWarm();
    vi.advanceTimersByTime(3000);
    expect(warmIsOn()).toBe(false);

    const live = holdCompositorWarm();
    // The timed-out hold is already released; calling it must not tear down
    // the flight that started afterwards.
    stale();

    expect(warmIsOn()).toBe(true);
    live();
    expect(warmIsOn()).toBe(false);
  });

  it("keeps the element when the engine refuses the effect", () => {
    stubAnimate(() => {
      throw new Error("unsupported");
    });

    const release = holdCompositorWarm();

    expect(warmIsOn()).toBe(true);
    // No animation to pause: the release must still idle the marker rather
    // than throw on the missing one.
    expect(() => release()).not.toThrow();
    expect(warmIsOn()).toBe(false);
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
    expect(warmIsOn()).toBe(false);
    release(); // must not underflow holders or idle a future hold
    const again = holdCompositorWarm();
    expect(warmIsOn()).toBe(true);
    again();
  });

  it("releasing one of two holds keeps the warm-up on", () => {
    stubAnimate();
    const first = holdCompositorWarm();
    const second = holdCompositorWarm();
    first();
    expect(warmIsOn()).toBe(true);
    second();
    expect(warmIsOn()).toBe(false);
  });
});

describe("holdCompositorWarm backstop", () => {
  it("drains a hold whose flight never reported its end", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      stubAnimate();
      const release = holdCompositorWarm();
      expect(warmIsOn()).toBe(true);
      vi.advanceTimersByTime(3001);
      expect(warmIsOn()).toBe(false);
      // The real release arriving after the backstop is a no-op.
      release();
      expect(warmIsOn()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("holdCompositorWarm backstop with siblings", () => {
  it("one drained backstop leaves a sibling hold forcing frames", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      stubAnimate();
      holdCompositorWarm(); // never released: its backstop drains it
      vi.advanceTimersByTime(1500);
      const late = holdCompositorWarm();
      vi.advanceTimersByTime(1600); // first backstop fires; late hold remains
      expect(warmIsOn()).toBe(true);
      late();
      expect(warmIsOn()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
