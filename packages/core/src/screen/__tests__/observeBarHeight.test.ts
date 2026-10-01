import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import observeBarHeight, { readBarHeight } from "@screen/observeBarHeight";

describe("observeBarHeight", () => {
  let observers: { callback: ResizeObserverCallback; disconnected: boolean }[];

  const emit = (entry: Partial<ResizeObserverEntry>) => {
    const observer = observers[0];
    observer.callback([entry as ResizeObserverEntry], undefined as unknown as ResizeObserver);
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
    document.body.replaceChildren();
  });

  // A laid-out bar: its layout height as CSS gives it, and the rounded
  // offsetHeight the old first reading took.
  const barElement = (height: number, extra: Partial<CSSStyleDeclaration> = {}): HTMLElement => {
    const element = document.createElement("div");
    element.style.height = `${height}px`;
    Object.assign(element.style, extra);
    Object.defineProperty(element, "offsetHeight", { value: Math.round(height) });
    document.body.appendChild(element);
    return element;
  };

  it("reports the current height immediately when already laid out", () => {
    const onHeight = vi.fn();
    observeBarHeight(barElement(56), onHeight);

    expect(onHeight).toHaveBeenCalledWith(56);
  });

  it("reports a fractional bar exactly, not rounded to the pixel offsetHeight gives", () => {
    // A 63.5px bar read as 64 first and 63.5 later moved the reservation by half
    // a pixel after every navigation had landed.
    const onHeight = vi.fn();
    observeBarHeight(barElement(63.5), onHeight);

    expect(onHeight).toHaveBeenCalledWith(63.5);
  });

  it("does not report an initial height of 0", () => {
    const onHeight = vi.fn();
    observeBarHeight(barElement(0), onHeight);

    expect(onHeight).not.toHaveBeenCalled();
  });

  it("follows resizes by the border box, and ignores a frozen (display:none) 0", () => {
    const onHeight = vi.fn();
    observeBarHeight(barElement(56), onHeight);

    // The border box, not the content box: a padded bar occupies its padding.
    emit({
      borderBoxSize: [{ blockSize: 64, inlineSize: 390 }],
      contentRect: { height: 48 } as DOMRectReadOnly
    });
    expect(onHeight).toHaveBeenLastCalledWith(64);

    emit({ borderBoxSize: [{ blockSize: 0, inlineSize: 390 }] });
    expect(onHeight).toHaveBeenCalledTimes(2); // the 0 is swallowed
  });

  it("measures the element itself where the entry carries no border box", () => {
    const onHeight = vi.fn();
    const bar = barElement(56);
    observeBarHeight(bar, onHeight);

    bar.style.height = "63.5px";
    emit({ contentRect: { height: 63.5 } as DOMRectReadOnly });
    expect(onHeight).toHaveBeenLastCalledWith(63.5);
  });

  it("disconnects on cleanup", () => {
    const dispose = observeBarHeight(barElement(56), vi.fn());
    dispose();

    expect(observers[0].disconnected).toBe(true);
  });
});

describe("readBarHeight", () => {
  afterEach(() => document.body.replaceChildren());

  it("adds padding and border to a content-box height", () => {
    const element = document.createElement("div");
    Object.assign(element.style, {
      boxSizing: "content-box",
      height: "40px",
      paddingTop: "8px",
      paddingBottom: "4.5px",
      borderTop: "1px solid",
      borderBottom: "1px solid"
    });
    document.body.appendChild(element);

    expect(readBarHeight(element)).toBe(54.5);
  });

  it("takes a border-box height as it is", () => {
    const element = document.createElement("div");
    Object.assign(element.style, { boxSizing: "border-box", height: "63.5px", paddingTop: "8px" });
    document.body.appendChild(element);

    expect(readBarHeight(element)).toBe(63.5);
  });

  it("falls back to the rounded layout height in a document with no window", () => {
    // A document made by DOMImplementation has no view to compute styles with.
    const element = document.implementation.createHTMLDocument().createElement("div");
    Object.defineProperty(element, "offsetHeight", { configurable: true, value: 64 });

    expect(readBarHeight(element)).toBe(64);
  });

  it("reads 0 from a bar with no layout height", () => {
    const element = document.createElement("div");
    element.style.height = "auto";
    document.body.appendChild(element);

    expect(readBarHeight(element)).toBe(0);
  });
});
