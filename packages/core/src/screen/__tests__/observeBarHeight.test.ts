import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import observeBarHeight from "@screen/observeBarHeight";

describe("observeBarHeight", () => {
  let observers: { callback: ResizeObserverCallback; disconnected: boolean }[];

  const emit = (height: number) => {
    const observer = observers[0];
    observer.callback(
      [{ contentRect: { height } } as ResizeObserverEntry],
      undefined as unknown as ResizeObserver
    );
  };

  beforeEach(() => {
    observers = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        entry: { callback: ResizeObserverCallback; disconnected: boolean };
        constructor(callback: ResizeObserverCallback) {
          this.entry = { callback, disconnected: false };
          observers.push(this.entry);
        }
        observe() {}
        disconnect() {
          this.entry.disconnected = true;
        }
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const barElement = (offsetHeight: number): HTMLElement => {
    const element = document.createElement("div");
    Object.defineProperty(element, "offsetHeight", { value: offsetHeight });
    return element;
  };

  it("reports the current height immediately when already laid out", () => {
    const onHeight = vi.fn();
    observeBarHeight(barElement(56), onHeight);

    expect(onHeight).toHaveBeenCalledWith(56);
  });

  it("does not report an initial height of 0", () => {
    const onHeight = vi.fn();
    observeBarHeight(barElement(0), onHeight);

    expect(onHeight).not.toHaveBeenCalled();
  });

  it("follows resizes but ignores a frozen (display:none) 0 so reserved space stays stable", () => {
    const onHeight = vi.fn();
    observeBarHeight(barElement(56), onHeight);

    emit(64);
    expect(onHeight).toHaveBeenLastCalledWith(64);

    emit(0);
    expect(onHeight).toHaveBeenCalledTimes(2); // the 0 is swallowed
  });

  it("disconnects on cleanup", () => {
    const dispose = observeBarHeight(barElement(56), vi.fn());
    dispose();

    expect(observers[0].disconnected).toBe(true);
  });
});
