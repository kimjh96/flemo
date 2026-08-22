import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import useKeyboardInset from "@screen/useKeyboardInset";

// The measurement itself is covered in @flemo/core (observeKeyboardInset).
// What matters here is the binding: the first paint is already correct, and a
// keyboard that opens or closes re-renders with the new inset.
describe("useKeyboardInset", () => {
  let listeners: Map<string, EventListener>;
  let frames: FrameRequestCallback[];
  let viewportHeight: number;

  const flushFrames = () => {
    const callbacks = [...frames];
    frames.length = 0;
    callbacks.forEach((frameCallback) => frameCallback(performance.now()));
  };

  const Pinned = () => {
    const keyboardInset = useKeyboardInset();
    return <div data-testid="pinned">{keyboardInset}</div>;
  };

  beforeEach(() => {
    listeners = new Map();
    frames = [];
    viewportHeight = 800;
    vi.stubGlobal("requestAnimationFrame", (frameCallback: FrameRequestCallback) => {
      frames.push(frameCallback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        get height() {
          return viewportHeight;
        },
        offsetTop: 0,
        scale: 1,
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
    vi.unstubAllGlobals();
  });

  it("paints the first frame with the keyboard already accounted for", () => {
    // A screen pushed from a focused field mounts while the keyboard is up; a
    // pinned element must not spend a frame behind it.
    viewportHeight = 500;

    render(<Pinned />);

    expect(screen.getByTestId("pinned").textContent).toBe("300");
  });

  it("follows the keyboard opening and closing", () => {
    render(<Pinned />);
    expect(screen.getByTestId("pinned").textContent).toBe("0");

    act(() => {
      viewportHeight = 500;
      listeners.get("resize")?.(new Event("resize"));
      flushFrames();
    });
    expect(screen.getByTestId("pinned").textContent).toBe("300");

    act(() => {
      viewportHeight = 800;
      listeners.get("resize")?.(new Event("resize"));
      flushFrames();
    });
    expect(screen.getByTestId("pinned").textContent).toBe("0");
  });

  it("releases its subscription on unmount", () => {
    const { unmount } = render(<Pinned />);
    expect(listeners.size).toBeGreaterThan(0);

    unmount();

    expect(listeners.size).toBe(0);
  });
});
