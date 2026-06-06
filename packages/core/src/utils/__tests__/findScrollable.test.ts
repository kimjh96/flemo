import { afterEach, beforeEach, describe, expect, it } from "vitest";

import findScrollable, { canProgrammaticallyScroll, overflowsAxis } from "@utils/findScrollable";

// `findScrollable` reads `scrollHeight` / `clientHeight` / `scrollWidth` /
// `clientWidth` from the live DOM. jsdom returns 0 for all of those, so any
// meaningful test has to define the values on the element instances via
// `Object.defineProperty`. This helper sets a stable layout snapshot per
// element without permanently polluting `HTMLElement.prototype`.
interface LayoutSnapshot {
  scrollHeight?: number;
  clientHeight?: number;
  scrollWidth?: number;
  clientWidth?: number;
  scrollTopMax?: number;
}

const mockLayout = (element: HTMLElement, snapshot: LayoutSnapshot) => {
  if (snapshot.scrollHeight !== undefined) {
    Object.defineProperty(element, "scrollHeight", {
      configurable: true,
      get: () => snapshot.scrollHeight
    });
  }
  if (snapshot.clientHeight !== undefined) {
    Object.defineProperty(element, "clientHeight", {
      configurable: true,
      get: () => snapshot.clientHeight
    });
  }
  if (snapshot.scrollWidth !== undefined) {
    Object.defineProperty(element, "scrollWidth", {
      configurable: true,
      get: () => snapshot.scrollWidth
    });
  }
  if (snapshot.clientWidth !== undefined) {
    Object.defineProperty(element, "clientWidth", {
      configurable: true,
      get: () => snapshot.clientWidth
    });
  }
};

let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
});
afterEach(() => {
  document.body.removeChild(host);
});

describe("overflowsAxis", () => {
  it("returns false when scroll-extent equals client-extent (no overflow)", () => {
    const el = document.createElement("div");
    mockLayout(el, { scrollHeight: 100, clientHeight: 100 });
    expect(overflowsAxis(el, "y")).toBe(false);

    mockLayout(el, { scrollWidth: 100, clientWidth: 100 });
    expect(overflowsAxis(el, "x")).toBe(false);
  });

  it("returns false when overflow is exactly 1px (sub-pixel noise filter)", () => {
    const el = document.createElement("div");
    mockLayout(el, { scrollHeight: 101, clientHeight: 100 });
    expect(overflowsAxis(el, "y")).toBe(false);
  });

  it("returns true when overflow is > 1px in the chosen axis", () => {
    const el = document.createElement("div");
    mockLayout(el, { scrollHeight: 200, clientHeight: 100 });
    expect(overflowsAxis(el, "y")).toBe(true);
  });

  it("treats axes independently: y overflow doesn't imply x overflow", () => {
    const el = document.createElement("div");
    mockLayout(el, {
      scrollHeight: 200,
      clientHeight: 100,
      scrollWidth: 100,
      clientWidth: 100
    });
    expect(overflowsAxis(el, "y")).toBe(true);
    expect(overflowsAxis(el, "x")).toBe(false);
  });
});

describe("findScrollable: null / unsafe inputs", () => {
  it("returns { null, false } when startTarget is null", () => {
    expect(findScrollable(null)).toEqual({ element: null, hasMarker: false });
  });

  it("falls back gracefully when startTarget is `document` (no parentElement chain)", () => {
    // `document` is an EventTarget but not an HTMLElement. The function
    // tries to use it as a start node and bails before crashing.
    const result = findScrollable(document);
    expect(result.element).toBeNull();
  });
});

describe("findScrollable: marker priority", () => {
  it("returns the [data-swipe-at-edge] ancestor when it overflows on the requested axis", () => {
    const marker = document.createElement("div");
    marker.setAttribute("data-swipe-at-edge", "");
    mockLayout(marker, { scrollWidth: 300, clientWidth: 100 });

    const inner = document.createElement("button");
    marker.appendChild(inner);
    host.appendChild(marker);

    const { element, hasMarker } = findScrollable(inner, { direction: "x" });
    expect(element).toBe(marker);
    expect(hasMarker).toBe(true);
  });

  it("ignores the marker when it does not overflow on the requested axis and walks parents instead", () => {
    const marker = document.createElement("div");
    marker.setAttribute("data-swipe-at-edge", "");
    // Marker has no overflow.
    mockLayout(marker, { scrollWidth: 100, clientWidth: 100 });

    // Marker's parent has overflow.
    const grand = document.createElement("section");
    mockLayout(grand, { scrollWidth: 400, clientWidth: 100 });
    grand.appendChild(marker);

    const inner = document.createElement("button");
    marker.appendChild(inner);
    host.appendChild(grand);

    const { element, hasMarker } = findScrollable(inner, { direction: "x" });
    expect(element).toBe(grand);
    expect(hasMarker).toBe(false);
  });

  it("respects a custom markerSelector option", () => {
    const customMarker = document.createElement("div");
    customMarker.setAttribute("data-custom-marker", "true");
    mockLayout(customMarker, { scrollWidth: 500, clientWidth: 100 });

    const inner = document.createElement("button");
    customMarker.appendChild(inner);
    host.appendChild(customMarker);

    const { element, hasMarker } = findScrollable(inner, {
      direction: "x",
      markerSelector: "[data-custom-marker]"
    });
    expect(element).toBe(customMarker);
    expect(hasMarker).toBe(true);
  });
});

describe("findScrollable: parent walk", () => {
  it("returns the first ancestor that overflows on the chosen axis", () => {
    const outer = document.createElement("section"); // overflows
    mockLayout(outer, { scrollHeight: 500, clientHeight: 200 });

    const middle = document.createElement("div"); // no overflow
    mockLayout(middle, { scrollHeight: 100, clientHeight: 100 });

    const inner = document.createElement("button"); // no overflow
    mockLayout(inner, { scrollHeight: 50, clientHeight: 50 });

    middle.appendChild(inner);
    outer.appendChild(middle);
    host.appendChild(outer);

    const { element, hasMarker } = findScrollable(inner, { direction: "y" });
    expect(element).toBe(outer);
    expect(hasMarker).toBe(false);
  });

  it("returns the closest overflowing ancestor when multiple match", () => {
    const grand = document.createElement("section");
    mockLayout(grand, { scrollHeight: 500, clientHeight: 200 });

    const parent = document.createElement("div");
    mockLayout(parent, { scrollHeight: 300, clientHeight: 100 });

    const inner = document.createElement("button");
    mockLayout(inner, { scrollHeight: 50, clientHeight: 50 });

    parent.appendChild(inner);
    grand.appendChild(parent);
    host.appendChild(grand);

    const { element } = findScrollable(inner, { direction: "y" });
    expect(element).toBe(parent); // closest, not grand
  });

  it("returns { null, false } when nothing in the chain overflows", () => {
    const outer = document.createElement("section");
    mockLayout(outer, { scrollHeight: 100, clientHeight: 100 });
    const inner = document.createElement("button");
    mockLayout(inner, { scrollHeight: 50, clientHeight: 50 });
    outer.appendChild(inner);
    host.appendChild(outer);

    const { element, hasMarker } = findScrollable(inner, { direction: "y" });
    expect(element).toBeNull();
    expect(hasMarker).toBe(false);
  });

  it("reaches documentElement (`<html>`) when it is the viewport scroller", () => {
    // Body has no overflow, but <html> does: typical viewport-scroll setup.
    mockLayout(document.body, { scrollHeight: 100, clientHeight: 100 });
    mockLayout(document.documentElement, { scrollHeight: 1000, clientHeight: 200 });

    const inner = document.createElement("button");
    mockLayout(inner, { scrollHeight: 50, clientHeight: 50 });
    host.appendChild(inner);

    const { element } = findScrollable(inner, { direction: "y" });
    expect(element).toBe(document.documentElement);
  });

  it("respects depthLimit: walking stops after the configured count", () => {
    // Build a chain of 5 wrappers; only the 5th overflows. With depthLimit:2
    // the walk gives up before reaching it.
    const chain: HTMLElement[] = [];
    let cursor: HTMLElement = host;
    for (let i = 0; i < 5; i++) {
      const wrapper = document.createElement("div");
      mockLayout(wrapper, { scrollHeight: 50, clientHeight: 50 });
      cursor.appendChild(wrapper);
      chain.push(wrapper);
      cursor = wrapper;
    }
    const deepest = chain[4]!;
    // Mock the *top* ancestor (chain[0]) to overflow. That requires walking
    // up from `deepest` past 5 layers.
    mockLayout(chain[0]!, { scrollHeight: 500, clientHeight: 100 });

    const inner = document.createElement("button");
    mockLayout(inner, { scrollHeight: 30, clientHeight: 30 });
    deepest.appendChild(inner);

    const withLimit = findScrollable(inner, { direction: "y", depthLimit: 2 });
    expect(withLimit.element).toBeNull();

    const withGenerous = findScrollable(inner, { direction: "y", depthLimit: 24 });
    expect(withGenerous.element).toBe(chain[0]);
  });
});

describe("canProgrammaticallyScroll: non-invasive computed-style probe", () => {
  it("returns false when overflow is absent (no style read either, fast path)", () => {
    const el = document.createElement("div");
    mockLayout(el, { scrollHeight: 100, clientHeight: 100 });
    expect(canProgrammaticallyScroll(el, "y")).toBe(false);
  });

  it("returns true when content overflows AND computed overflowY is `auto`", () => {
    const el = document.createElement("div");
    mockLayout(el, { scrollHeight: 500, clientHeight: 100 });
    el.style.overflowY = "auto";
    host.appendChild(el);
    expect(canProgrammaticallyScroll(el, "y")).toBe(true);
  });

  it("returns true when content overflows AND computed overflowY is `scroll`", () => {
    const el = document.createElement("div");
    mockLayout(el, { scrollHeight: 500, clientHeight: 100 });
    el.style.overflowY = "scroll";
    host.appendChild(el);
    expect(canProgrammaticallyScroll(el, "y")).toBe(true);
  });

  it("returns false when content overflows but overflowY is `hidden` (locked scroller)", () => {
    const el = document.createElement("div");
    mockLayout(el, { scrollHeight: 500, clientHeight: 100 });
    el.style.overflowY = "hidden";
    host.appendChild(el);
    expect(canProgrammaticallyScroll(el, "y")).toBe(false);
  });

  it("does NOT mutate scrollTop while probing", () => {
    const el = document.createElement("div");
    mockLayout(el, { scrollHeight: 500, clientHeight: 100 });
    el.style.overflowY = "auto";
    host.appendChild(el);

    let setCount = 0;
    let value = 42;
    Object.defineProperty(el, "scrollTop", {
      configurable: true,
      get: () => value,
      set: (v) => {
        setCount += 1;
        value = v;
      }
    });

    canProgrammaticallyScroll(el, "y");
    expect(setCount).toBe(0);
    expect(value).toBe(42);
  });

  it("checks the correct axis: overflowX governs `x`, overflowY governs `y`", () => {
    const el = document.createElement("div");
    mockLayout(el, { scrollHeight: 500, clientHeight: 100, scrollWidth: 500, clientWidth: 100 });
    el.style.overflowY = "auto";
    el.style.overflowX = "hidden";
    host.appendChild(el);
    expect(canProgrammaticallyScroll(el, "y")).toBe(true);
    expect(canProgrammaticallyScroll(el, "x")).toBe(false);
  });
});
