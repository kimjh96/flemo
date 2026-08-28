import { describe, expect, it } from "vitest";

import { clipTravel, visibleInset } from "@morph/morphClip";

// WHAT THE SCROLLPORT WAS HIDING, measured per side as a fraction of the box.
//
// A cell scrolled to the list's edge is half covered by the chrome stacked
// flush against that edge. The flight layer clips nothing, so without this
// measurement the hidden half paints the instant the element is staged and
// the flight carries it straight across the tab bar it was under.

const box = (
  parent: HTMLElement | null,
  bounds: [number, number, number, number],
  overflowY = ""
): HTMLElement => {
  const element = document.createElement("div");
  if (overflowY) element.style.overflowY = overflowY;
  element.getBoundingClientRect = () =>
    ({
      x: bounds[0],
      y: bounds[1],
      width: bounds[2],
      height: bounds[3],
      top: bounds[1],
      left: bounds[0],
      right: bounds[0] + bounds[2],
      bottom: bounds[1] + bounds[3],
      toJSON: () => ({})
    }) as DOMRect;
  (parent ?? document.body).appendChild(element);
  return element;
};

describe("visibleInset", () => {
  it("reports the fraction a scrolling ancestor cuts from each side", () => {
    // Scroller shows y 600..700; the cell spans y 650..730, so 30 of its 80px
    // — 37.5% — hang below the edge, under whatever chrome stacks there.
    const scroller = box(null, [0, 600, 400, 100], "auto");
    const cell = box(scroller, [20, 650, 80, 80]);
    expect(visibleInset(cell)).toEqual({
      top: 0,
      right: 0,
      bottom: 37.5,
      left: 0
    });
  });

  it("is null for an element its ancestors show whole", () => {
    const scroller = box(null, [0, 0, 400, 800], "auto");
    const cell = box(scroller, [20, 100, 80, 80]);
    expect(visibleInset(cell)).toBeNull();
  });

  it("ignores ancestors that do not clip, and zero-sized ones", () => {
    // overflow: visible never clips; a 0x0 ancestor is jsdom (every default
    // rect here), not a clip worth honouring — which is also what keeps this
    // channel silent across the rest of this suite.
    const wrapper = box(null, [0, 0, 0, 0], "hidden");
    const plain = box(wrapper, [0, 400, 400, 400]);
    const cell = box(plain, [20, 700, 80, 80]);
    expect(visibleInset(cell)).toBeNull();
  });
});

describe("visibleInset hostile paths", () => {
  it("cuts horizontally too, when an ancestor clips on the x axis", () => {
    // A horizontal scroller at the stage's edge hides part of a row the same
    // way the vertical one does; the inset carries per side.
    const scroller = box(null, [0, 0, 300, 800], "");
    scroller.style.overflowX = "scroll";
    const cell = box(scroller, [260, 100, 80, 80]);
    expect(visibleInset(cell)).toEqual({ top: 0, right: 50, bottom: 0, left: 0 });
  });

  it("declines when an ancestor's computed style cannot be read", () => {
    // A detached-ish or cross-realm node can make getComputedStyle throw; a
    // clip measurement must never take the flight down with it.
    const scroller = box(null, [0, 600, 400, 100], "auto");
    const cell = box(scroller, [20, 650, 80, 80]);
    const original = globalThis.getComputedStyle;
    (globalThis as { getComputedStyle: typeof getComputedStyle }).getComputedStyle = () => {
      throw new Error("no styles here");
    };
    try {
      expect(visibleInset(cell)).toBeNull();
    } finally {
      (globalThis as { getComputedStyle: typeof getComputedStyle }).getComputedStyle = original;
    }
  });
});

describe("visibleInset guards", () => {
  it("declines a missing, detached, or unlaid element", () => {
    expect(visibleInset(null)).toBeNull();
    const loose = document.createElement("div");
    expect(visibleInset(loose)).toBeNull();
    const flat = box(null, [0, 0, 0, 0]);
    expect(visibleInset(flat)).toBeNull();
  });
});

describe("clipTravel", () => {
  it("is null when neither end was clipped", () => {
    expect(clipTravel(null, null)).toBeNull();
  });

  it("fills the unclipped FROM end with zeros too", () => {
    const to = { top: 0, right: 0, bottom: 44.7, left: 0 };
    expect(clipTravel(null, to)).toEqual({
      from: { top: 0, right: 0, bottom: 0, left: 0 },
      to
    });
  });

  it("fills the unclipped end with zeros so the inset can interpolate", () => {
    const from = { top: 0, right: 0, bottom: 37.5, left: 0 };
    expect(clipTravel(from, null)).toEqual({
      from,
      to: { top: 0, right: 0, bottom: 0, left: 0 }
    });
  });
});
