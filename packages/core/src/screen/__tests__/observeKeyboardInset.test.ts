import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import observeKeyboardInset, {
  measureKeyboardInset,
  resetKeyboardInsetForTesting
} from "@screen/observeKeyboardInset";

// The module keeps ONE app-wide session (latest measurement, one registration)
// shared by every screen, so each case starts from a cleared one.
describe("observeKeyboardInset", () => {
  let listeners: Map<string, EventListener>;
  let frames: Map<number, FrameRequestCallback>;
  let frameId: number;
  let viewportHeight: number;
  let offsetTop: number;
  let scale: number;

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
    offsetTop = 0;
    scale = 1;
    vi.stubGlobal("requestAnimationFrame", (frameCallback: FrameRequestCallback) => {
      frames.set(++frameId, frameCallback);
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      frames.delete(id);
    });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        get height() {
          return viewportHeight;
        },
        get offsetTop() {
          return offsetTop;
        },
        get scale() {
          return scale;
        },
        addEventListener: (type: string, listener: EventListener) => {
          listeners.set(type, listener);
        },
        removeEventListener: (type: string) => {
          listeners.delete(type);
        }
      }
    });
  });

  afterEach(() => {
    resetKeyboardInsetForTesting();
    vi.unstubAllGlobals();
  });

  it("reports how much of the layout viewport the keyboard covers", () => {
    const seen: number[] = [];
    observeKeyboardInset((inset) => seen.push(inset));
    flushFrames();

    viewportHeight = 500; // a 300px keyboard
    trigger();

    expect(seen.at(-1)).toBe(300);
  });

  it("counts the visual viewport sliding down, not just shrinking", () => {
    const seen: number[] = [];
    observeKeyboardInset((inset) => seen.push(inset));
    flushFrames();

    // The page scrolled a focused field into view: the visual viewport moved
    // down inside the layout viewport by 120px while the keyboard stayed 300px.
    viewportHeight = 500;
    offsetTop = 120;
    trigger();

    // Without the offsetTop term this would report 300 and the pinned element
    // would sit 120px inside the keyboard.
    expect(seen.at(-1)).toBe(180);
  });

  it("reads zero with no keyboard, and ignores browser-chrome sized changes", () => {
    const seen: number[] = [];
    observeKeyboardInset((inset) => seen.push(inset));
    flushFrames();
    expect(seen.at(-1)).toBe(0);

    viewportHeight = 790; // a collapsing URL bar, not a keyboard
    trigger();

    expect(seen.at(-1)).toBe(0);
  });

  it("reports zero while the page is pinch-zoomed", () => {
    const seen: number[] = [];
    observeKeyboardInset((inset) => seen.push(inset));
    flushFrames();

    viewportHeight = 400;
    scale = 2;
    trigger();

    expect(seen.at(-1)).toBe(0);
  });

  it("hands the current inset to a subscriber that attaches late", () => {
    observeKeyboardInset(() => {});
    flushFrames();
    viewportHeight = 500;
    trigger();

    // A screen woken from freeze: its effects re-run while the keyboard is
    // already open, and it must not start from 0.
    const late: number[] = [];
    observeKeyboardInset((inset) => late.push(inset));

    expect(late[0]).toBe(300);
  });

  it("measures on the first attach so a mid-session mount starts correct", () => {
    viewportHeight = 500;

    const seen: number[] = [];
    observeKeyboardInset((inset) => seen.push(inset));
    flushFrames();

    expect(seen.at(-1)).toBe(300);
  });

  it("keeps one registration for many subscribers and releases it with the last", () => {
    const disposeFirst = observeKeyboardInset(() => {});
    const disposeSecond = observeKeyboardInset(() => {});
    expect(listeners.has("resize")).toBe(true);

    disposeFirst();
    expect(listeners.has("resize")).toBe(true);

    disposeSecond();
    expect(listeners.has("resize")).toBe(false);
  });

  it("measures directly for callers that only want the number", () => {
    viewportHeight = 500;
    expect(measureKeyboardInset()).toBe(300);
  });
});
