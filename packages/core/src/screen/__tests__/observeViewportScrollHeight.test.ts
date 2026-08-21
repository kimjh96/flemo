import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import observeViewportScrollHeight, {
  resetViewportScrollHeightForTesting
} from "@screen/observeViewportScrollHeight";

// The module keeps ONE app-wide session (baseline, latest measurement, one
// registration) shared by every screen, so each case starts from a cleared one.
describe("observeViewportScrollHeight", () => {
  let listeners: Map<string, EventListener>;
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  let viewportHeight: number;

  const flushFrames = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((frameCallback) => frameCallback(performance.now()));
  };

  const trigger = () => {
    listeners.get("resize")?.(new Event("resize"));
    flushFrames();
  };

  beforeEach(() => {
    listeners = new Map();
    frames = new Map();
    frameId = 0;
    viewportHeight = 800;
    vi.stubGlobal("requestAnimationFrame", (frameCallback: FrameRequestCallback) => {
      frames.set(++frameId, frameCallback);
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      frames.delete(id);
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        get height() {
          return viewportHeight;
        },
        addEventListener: (type: string, listener: EventListener) => {
          listeners.set(type, listener);
        },
        removeEventListener: (type: string) => {
          listeners.delete(type);
        }
      }
    });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 800
    });
    resetViewportScrollHeightForTesting();
  });

  afterEach(() => {
    resetViewportScrollHeightForTesting();
    vi.unstubAllGlobals();
  });

  it("clamps at 0 while the viewport covers the document (no keyboard)", () => {
    const onChange = vi.fn();
    const dispose = observeViewportScrollHeight(onChange);

    trigger();

    expect(onChange).toHaveBeenCalledWith(0, 0);
    dispose();
  });

  it("reports the shortfall when the visual viewport shrinks (keyboard open)", () => {
    const onChange = vi.fn();
    const dispose = observeViewportScrollHeight(onChange);

    viewportHeight = 500; // keyboard eats 300px
    trigger();

    expect(onChange).toHaveBeenLastCalledWith(300, 300);
    dispose();
  });

  it("coalesces bursts into one rAF measurement and cleans its listeners up", () => {
    const onChange = vi.fn();
    const dispose = observeViewportScrollHeight(onChange);

    listeners.get("resize")?.(new Event("resize"));
    listeners.get("scroll")?.(new Event("scroll"));
    flushFrames();

    // Two events, but the second cancelled the first's frame: one measurement.
    expect(onChange).toHaveBeenCalledTimes(1);

    dispose();
    expect(listeners.size).toBe(0);
  });

  it("serves every subscriber from ONE registration and ONE measurement", () => {
    const first = vi.fn();
    const second = vi.fn();
    const disposeFirst = observeViewportScrollHeight(first);
    const disposeSecond = observeViewportScrollHeight(second);

    // resize + scroll, once for the whole app whatever the subscriber count.
    expect(listeners.size).toBe(2);

    viewportHeight = 500;
    trigger();
    expect(frames.size).toBe(0); // one frame served both

    expect(first).toHaveBeenLastCalledWith(300, 300);
    expect(second).toHaveBeenLastCalledWith(300, 300);

    disposeFirst();
    // The survivor keeps the registration alive.
    expect(listeners.size).toBe(2);
    disposeSecond();
    expect(listeners.size).toBe(0);
  });

  // The regression this handover exists to prevent: a screen frozen by React's
  // <Activity> keeps its state but loses its subscription, so it must be told
  // the CURRENT shortfall the moment it re-subscribes. Without it the screen
  // wakes still believing a keyboard that has long closed is open, and the
  // binding keeps its shared bottom bar hidden until the next viewport event.
  it("hands the current measurement to a subscriber attaching later", () => {
    const live = vi.fn();
    const disposeLive = observeViewportScrollHeight(live);

    viewportHeight = 500; // keyboard opens
    trigger();
    expect(live).toHaveBeenLastCalledWith(300, 300);

    viewportHeight = 800; // ... and closes while the covered screen is frozen
    trigger();
    expect(live).toHaveBeenLastCalledWith(0, 0);

    // The woken screen re-subscribes and learns the keyboard is gone at once.
    const woken = vi.fn();
    const disposeWoken = observeViewportScrollHeight(woken);

    expect(woken).toHaveBeenCalledWith(0, 0);

    disposeWoken();
    disposeLive();
  });

  // Same handover for a screen that re-subscribes with no other observer left
  // (a pop can land the leaving screen's unmount and the returning screen's
  // wake in ONE commit), plus a fresh measurement, since a listener-less window
  // could have swallowed an event.
  it("hands over AND re-measures when the last observer had gone", () => {
    const first = vi.fn();
    const disposeFirst = observeViewportScrollHeight(first);
    viewportHeight = 500;
    trigger();
    disposeFirst();

    viewportHeight = 800; // the keyboard closes with nobody listening

    const woken = vi.fn();
    const dispose = observeViewportScrollHeight(woken);
    expect(woken).toHaveBeenCalledWith(300, 300); // last known, immediately
    flushFrames();
    expect(woken).toHaveBeenLastCalledWith(0, 0); // corrected a frame later

    dispose();
  });

  it("stays silent for a subscriber attaching before anything has measured", () => {
    const onChange = vi.fn();
    const dispose = observeViewportScrollHeight(onChange);

    // Boot: no event yet, so no shortfall is asserted and no layout is read.
    expect(onChange).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);

    dispose();
  });
});
