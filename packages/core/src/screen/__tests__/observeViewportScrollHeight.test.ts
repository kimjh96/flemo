import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import observeViewportScrollHeight from "@screen/observeViewportScrollHeight";

// The module keeps ONE app-wide baseline (first non-zero measurement), so the
// assertions below are sequence-aware within this file.
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
  });

  afterEach(() => {
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
});
