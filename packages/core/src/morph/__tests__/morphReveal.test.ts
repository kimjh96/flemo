import { afterEach, describe, expect, it, vi } from "vitest";

import { PAINT_PROPERTIES } from "@morph/morphPaint";
import { revealHolds, revealRules, type RevealStyle } from "@morph/morphReveal";

// A REVEAL IS A CLIP, AND IT IS ONLY ALLOWED WHERE IT IS PROVEN HARMLESS.
//
// A box whose contents hold is laid out once at the larger end and cut back
// with clip-path. The playground's featured card lost its shadow for a whole
// flight that way and spread its gradient over the larger end. Naming those two
// left a border, an outline, a mask and every other property waiting, so the
// runtime now allows the reveal only when every computed property is known to
// be harmless or at its initial value, and refuses anything it does not know.

const styleOf = (values: Record<string, string>): RevealStyle => {
  const names = Object.keys(values);
  return {
    length: names.length,
    item: (index: number) => names[index] ?? "",
    getPropertyValue: (property: string) => values[property] ?? ""
  };
};

/** Tailwind's four empty ring layers, present on every element with a shadow utility. */
const RINGS = Array(4).fill("rgba(0, 0, 0, 0) 0px 0px 0px 0px").join(", ");

/** What a plain clipped card computes to under Tailwind's preflight, read off Chrome. */
const PLAIN = {
  "overflow-x": "hidden",
  "overflow-y": "hidden",
  "overflow-block": "hidden",
  "overflow-inline": "hidden",
  display: "block",
  position: "relative",
  "box-sizing": "border-box",
  "border-top-style": "solid",
  "border-top-width": "0px",
  "border-block-end-width": "0px",
  "border-top-color": "rgb(255, 255, 255)",
  "border-top-left-radius": "24px",
  "border-start-start-radius": "24px",
  "background-color": "rgb(99, 102, 241)",
  "box-shadow": RINGS,
  "overflow-clip-margin": "content-box",
  "transform-origin": "161px 71px",
  "row-rule-color": "rgb(255, 255, 255)",
  "font-feature-settings": '"cv01", "ss01"',
  "-webkit-tap-highlight-color": "rgba(0, 0, 0, 0)",
  "--tw-shadow": "0 0 #0000"
};

const mount = (tag = "div") => {
  const box = document.createElement(tag);
  document.body.appendChild(box);
  return box;
};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("revealHolds", () => {
  it("reveals a clipped box whose every property is proven harmless", () => {
    expect(revealHolds(mount(), styleOf(PLAIN), {})).toBe(true);
  });

  it("lays a box out for real where it does not clip its overflow", () => {
    // The clip cuts at the border box on every side, so contents painting past
    // it are the same picture only if the box was cutting them already.
    expect(
      revealHolds(
        mount(),
        styleOf({ ...PLAIN, "overflow-x": "visible", "overflow-y": "visible" }),
        {}
      )
    ).toBe(false);
    expect(revealHolds(mount(), styleOf({}), {})).toBe(false);
  });

  it.each([
    ["a shadow", "box-shadow", `${RINGS}, rgba(139, 92, 246, 0.2) 0px 20px 25px -5px`],
    ["a border on the cut edge", "border-bottom-width", "1px"],
    ["a border by its logical name", "border-inline-start-width", "1px"],
    ["an outline or focus ring", "outline-style", "auto"],
    ["a gradient", "background-image", "linear-gradient(rgb(0, 0, 0), rgb(255, 255, 255))"],
    ["a mask", "mask-image", "linear-gradient(black, transparent)"],
    ["a prefixed mask", "-webkit-mask-image", "url(a.png)"],
    ["a border image", "border-image-source", "url(a.png)"],
    ["an authored clip-path", "clip-path", "inset(4px)"],
    ["a filter", "filter", "drop-shadow(rgb(0, 0, 0) 0px 4px 8px)"],
    ["a backdrop filter", "backdrop-filter", "blur(8px)"],
    ["a transform", "transform", "matrix(1, 0, 0, 1, 0, 4)"],
    ["an individual rotation", "rotate", "5deg"],
    ["a percentage corner", "border-top-left-radius", "50%"],
    ["a scrolling box", "overflow-y", "auto"],
    ["a clip margin", "overflow-clip-margin", "8px"],
    ["an ellipsis", "text-overflow", "ellipsis"],
    ["a line clamp", "-webkit-line-clamp", "2"],
    ["a native widget", "appearance", "button"],
    ["a resizer", "resize", "both"],
    ["replaced content", "content", 'url("a.png")'],
    ["a column rule", "column-rule-style", "solid"],
    ["a property it has never heard of", "corner-shape", "squircle"]
  ])("lays a box with %s out for real", (_, property, value) => {
    expect(revealHolds(mount(), styleOf({ ...PLAIN, [property]: value }), {})).toBe(false);
  });

  it("lets a property it does not know through at its initial value", () => {
    // Initial values are read off an `all: initial` probe in the same document.
    const real = window.getComputedStyle.bind(window);
    const box = mount();
    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) =>
      element !== box && element.getAttribute("aria-hidden") === "true"
        ? (styleOf({ "corner-shape": "round" }) as unknown as CSSStyleDeclaration)
        : real(element, pseudo)
    );
    const color = "rgb(1, 2, 3)";
    expect(revealHolds(box, styleOf({ ...PLAIN, color, "corner-shape": "round" }), {})).toBe(true);
    expect(revealHolds(box, styleOf({ ...PLAIN, color, "corner-shape": "squircle" }), {})).toBe(
      false
    );
  });

  it("holds the departure's carried paint to the same rules", () => {
    // The departure reaches the arrival only through the paint table, and a
    // value it carries in paints mid-flight even where the arrival has none.
    const box = mount();
    const departs = (paint: Record<string, string>) => revealHolds(box, styleOf(PLAIN), paint);
    expect(
      departs({
        "border-radius": "16px",
        "background-color": "rgb(0, 0, 0)",
        "box-shadow": RINGS,
        "border-width": "0px 0px 0px 0px",
        color: "rgb(255, 255, 255)"
      })
    ).toBe(true);
    expect(departs({ "box-shadow": "rgba(0, 0, 0, 0.2) 0px 4px 12px 0px" })).toBe(false);
    expect(departs({ "border-width": "2px 0px 0px 0px" })).toBe(false);
    expect(departs({ filter: "blur(4px)" })).toBe(false);
    expect(departs({ "border-radius": "50%" })).toBe(false);
    expect(departs({ "made-up-channel": "1" })).toBe(false);
  });

  it("has a rule for every paint channel, so a new channel is decided when it is added", () => {
    for (const property of PAINT_PROPERTIES) expect(revealRules(property), property).toBe(true);
  });

  it("lays out a box with a pseudo-element the contents probe never sees", () => {
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) =>
      pseudo === "::after"
        ? (styleOf({ content: '""' }) as unknown as CSSStyleDeclaration)
        : real(element, pseudo)
    );
    expect(revealHolds(mount(), styleOf(PLAIN), {})).toBe(false);
  });

  it("lays out replaced and vector content, which draws itself to the box", () => {
    expect(revealHolds(mount("img"), styleOf(PLAIN), {})).toBe(false);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    document.body.appendChild(svg);
    expect(revealHolds(svg, styleOf(PLAIN), {})).toBe(false);
  });

  it("lays out a box holding a backdrop filter, which the clip would cut off from the page", () => {
    const box = mount();
    const glass = box.appendChild(document.createElement("span"));
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) =>
      element === glass
        ? (styleOf({ "backdrop-filter": "blur(12px)" }) as unknown as CSSStyleDeclaration)
        : real(element, pseudo)
    );
    expect(revealHolds(box, styleOf(PLAIN), {})).toBe(false);
  });

  it("reads an empty shadow layer, a slashed alpha and a comma alpha as painting nothing", () => {
    // Every shape a computed shadow list arrives in. An engine that reports no
    // shadow at all, one that writes the alpha after a slash, one that writes
    // it as a fourth comma channel, and one that carries a colour with no
    // length beside it: none of them paint, and the reveal has to say so for
    // all four or a plain card lays itself out every frame for nothing.
    for (const shadow of [
      "",
      "none",
      "rgb(0 0 0 / 0) 0px 4px 8px 0px",
      "rgba(0, 0, 0, 0) 0px 4px 8px",
      "rgb(15 23 42)"
    ]) {
      expect(revealHolds(mount(), styleOf({ ...PLAIN, "box-shadow": shadow }), {}), shadow).toBe(
        true
      );
    }
    // And one that does paint still refuses, so the readings above are not
    // simply everything being waved through.
    expect(
      revealHolds(mount(), styleOf({ ...PLAIN, "box-shadow": "rgb(0 0 0 / 0.4) 0px 4px 8px" }), {})
    ).toBe(false);
  });

  it("holds content-visibility and clip to their own values", () => {
    expect(revealHolds(mount(), styleOf({ ...PLAIN, "content-visibility": "visible" }), {})).toBe(
      true
    );
    expect(revealHolds(mount(), styleOf({ ...PLAIN, "content-visibility": "auto" }), {})).toBe(
      false
    );
    expect(revealHolds(mount(), styleOf({ ...PLAIN, clip: "auto" }), {})).toBe(true);
    expect(
      revealHolds(mount(), styleOf({ ...PLAIN, clip: "rect(0px, 10px, 10px, 0px)" }), {})
    ).toBe(false);
  });

  it("skips the custom properties a page sets on the box itself", () => {
    // A theme's own variables are on every element of a Tailwind page and none
    // of them is a paint channel; a rule table that had to name them all would
    // be a table of the consumer's design system.
    expect(revealHolds(mount(), styleOf({ ...PLAIN, "--brand": "oklch(0.7 0.2 250)" }), {})).toBe(
      true
    );
  });

  it("lays out a box holding a webkit backdrop filter", () => {
    const box = mount();
    const glass = box.appendChild(document.createElement("span"));
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) =>
      element === glass
        ? (styleOf({ "-webkit-backdrop-filter": "blur(12px)" }) as unknown as CSSStyleDeclaration)
        : real(element, pseudo)
    );
    expect(revealHolds(box, styleOf(PLAIN), {})).toBe(false);
  });

  it("lays out a box with more descendants than it will walk", () => {
    // The walk is bounded because it runs on the navigation frame. A subtree
    // past the bound is not proven harmless, so it takes the real layout.
    const box = mount();
    box.innerHTML = Array(257).fill("<span></span>").join("");
    expect(revealHolds(box, styleOf(PLAIN), {})).toBe(false);
  });

  it("reads a shadow written with no colour at all", () => {
    // An engine may report the colour as the page's own `color`, leaving the
    // layer as lengths alone. Lengths are what decide whether it paints.
    expect(revealHolds(mount(), styleOf({ ...PLAIN, "box-shadow": "0px 0px 0px" }), {})).toBe(true);
    expect(revealHolds(mount(), styleOf({ ...PLAIN, "box-shadow": "0px 4px 8px" }), {})).toBe(
      false
    );
  });

  it("builds the initial-value probe once per document and colour", () => {
    // Reading a full computed style off a throwaway element is the expensive
    // half of the rule, and it happens on the navigation frame. It is answered
    // from the document's own cache from the second flight onwards.
    const made = vi.spyOn(document, "createElement");
    revealHolds(mount(), styleOf(PLAIN), {});
    const first = made.mock.calls.filter(([tag]) => tag === "div").length;
    revealHolds(mount(), styleOf(PLAIN), {});
    const second = made.mock.calls.filter(([tag]) => tag === "div").length;
    expect(second - first).toBe(1);
  });

  it("probes against the document element where a page has no body", () => {
    const box = mount();
    document.documentElement.appendChild(box);
    document.body.remove();
    expect(revealHolds(box, styleOf(PLAIN), {})).toBe(true);
    document.documentElement.appendChild(document.createElement("body"));
  });

  it("refuses without a computed style to read", () => {
    expect(revealHolds(mount(), null, {})).toBe(false);
  });
});
