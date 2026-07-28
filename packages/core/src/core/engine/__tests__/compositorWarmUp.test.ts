import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import holdCompositorWarm, { WARM_ATTR } from "@core/engine/compositorWarmUp";

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
