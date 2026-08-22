import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WARM_ATTR, attrSelector } from "@dom/attributes";
import { resetFlemoRuntimeForTests, startFlemoRuntime } from "@runtime/flemoRuntime";

// The ambient runtime: what an app sits in so the FIRST navigation is not the
// one that pays for it. None of it is triggered by a navigation, and none of it
// is framework-specific — which is why it lives here rather than in a binding.
//
// The refcount is the part worth pinning. A binding starts the runtime per
// Router mount, so a nested Router starts a second one; before this module they
// each installed their own document listeners.

const warmElement = () => document.querySelector(attrSelector(WARM_ATTR));

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no compositing, so the warm-up's animation is stubbed; the
  // element's lifecycle is what this suite is about.
  Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation);
});

afterEach(() => {
  resetFlemoRuntimeForTests();
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const node of document.querySelectorAll(attrSelector(WARM_ATTR))) node.remove();
});

describe("startFlemoRuntime", () => {
  it("warms the compositor on interaction, and releases after the tail", () => {
    const release = startFlemoRuntime();
    expect(warmElement()).toBeNull();

    document.dispatchEvent(new Event("pointermove"));
    expect(warmElement()).not.toBeNull();

    // The hold outlives the interaction — the gap between a pointer settling
    // and the tap that follows it is what this is covering.
    vi.advanceTimersByTime(2_000);
    expect(warmElement()).not.toBeNull();
    vi.advanceTimersByTime(2_000);
    expect(warmElement()).toBeNull();

    release();
  });

  it("renewal extends the hold rather than restarting it", () => {
    const release = startFlemoRuntime();

    document.dispatchEvent(new Event("pointermove"));
    vi.advanceTimersByTime(2_000);
    document.dispatchEvent(new Event("pointermove")); // past the throttle: renews

    // Without the renewal the hold would have expired at 3s. It has not.
    vi.advanceTimersByTime(2_000);
    expect(warmElement()).not.toBeNull();
    // And the tail runs from the RENEWAL, not the first interaction.
    vi.advanceTimersByTime(1_500);
    expect(warmElement()).toBeNull();

    release();
  });

  it("throttles renewals — interaction events fire per frame", () => {
    const release = startFlemoRuntime();

    document.dispatchEvent(new Event("pointermove"));
    // A 400ms burst, every event inside the throttle window.
    for (let i = 0; i < 20; i += 1) {
      vi.advanceTimersByTime(20);
      document.dispatchEvent(new Event("pointermove"));
    }
    // All of them were dropped, so the tail still expires on the FIRST
    // interaction's clock — a renewal would have pushed it past this point.
    vi.advanceTimersByTime(2_700);
    expect(warmElement()).toBeNull();

    release();
  });

  it("takes every interaction that precedes a navigation", () => {
    const release = startFlemoRuntime();
    for (const type of ["pointerdown", "wheel", "touchstart", "keydown"]) {
      document.dispatchEvent(new Event(type));
      expect(warmElement(), type).not.toBeNull();
      vi.advanceTimersByTime(4_000);
      vi.advanceTimersByTime(600); // clear the renewal throttle
    }
    release();
  });

  it("is refcounted: an inner Router unmounting leaves the outer one running", () => {
    const outer = startFlemoRuntime();
    const inner = startFlemoRuntime();

    inner();

    // The outer holder still owns the runtime, so interaction still warms.
    document.dispatchEvent(new Event("pointermove"));
    expect(warmElement()).not.toBeNull();

    outer();
    vi.advanceTimersByTime(4_000);
    expect(warmElement()).toBeNull();
  });

  it("stops listening once the last holder releases", () => {
    const release = startFlemoRuntime();
    release();

    document.dispatchEvent(new Event("pointermove"));
    expect(warmElement()).toBeNull();
  });

  it("ignores a repeated release from the same holder", () => {
    const outer = startFlemoRuntime();
    const inner = startFlemoRuntime();
    inner();
    inner();
    inner();

    // A sloppy caller must not tear down a runtime the outer holder still owns.
    document.dispatchEvent(new Event("pointermove"));
    expect(warmElement()).not.toBeNull();

    outer();
  });
});
