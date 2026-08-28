import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RIDE_HEIGHT_VAR } from "@transition/rideOffset";

import publishRideBox from "@screen/publishRideBox";

describe("publishRideBox", () => {
  let observers: { callback: ResizeObserverCallback; disconnected: boolean }[];

  const emit = (entry: { borderBoxSize?: { blockSize: number }[]; contentHeight: number }) => {
    observers[0]!.callback(
      [
        {
          borderBoxSize: entry.borderBoxSize,
          contentRect: { height: entry.contentHeight }
        } as unknown as ResizeObserverEntry
      ],
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

  const screenElement = (offsetHeight: number): HTMLElement => {
    const element = document.createElement("div");
    Object.defineProperty(element, "offsetHeight", { value: offsetHeight });
    return element;
  };

  it("publishes the current box immediately when already laid out", () => {
    const element = screenElement(770);
    publishRideBox(element);

    expect(element.style.getPropertyValue(RIDE_HEIGHT_VAR)).toBe("770px");
  });

  it("publishes nothing before the screen has a box, so the keyframe fallback stands", () => {
    const element = screenElement(0);
    publishRideBox(element);

    expect(element.style.getPropertyValue(RIDE_HEIGHT_VAR)).toBe("");
  });

  it("prefers the border box, which is what a percentage translate resolves against", () => {
    const element = screenElement(770);
    publishRideBox(element);

    emit({ borderBoxSize: [{ blockSize: 640 }], contentHeight: 600 });
    expect(element.style.getPropertyValue(RIDE_HEIGHT_VAR)).toBe("640px");
  });

  it("falls back to contentRect where borderBoxSize is missing", () => {
    const element = screenElement(770);
    publishRideBox(element);

    emit({ contentHeight: 600 });
    expect(element.style.getPropertyValue(RIDE_HEIGHT_VAR)).toBe("600px");
  });

  it("keeps the last real height when a frozen screen measures 0", () => {
    const element = screenElement(770);
    publishRideBox(element);

    emit({ contentHeight: 0 });
    expect(element.style.getPropertyValue(RIDE_HEIGHT_VAR)).toBe("770px");
  });

  it("ignores an empty entry list", () => {
    const element = screenElement(770);
    publishRideBox(element);

    observers[0]!.callback([], undefined as unknown as ResizeObserver);
    expect(element.style.getPropertyValue(RIDE_HEIGHT_VAR)).toBe("770px");
  });

  it("disconnects and drops the property on cleanup", () => {
    const element = screenElement(770);
    const dispose = publishRideBox(element);
    dispose();

    expect(observers[0]!.disconnected).toBe(true);
    expect(element.style.getPropertyValue(RIDE_HEIGHT_VAR)).toBe("");
  });
});
