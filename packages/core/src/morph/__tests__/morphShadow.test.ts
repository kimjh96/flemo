import { describe, expect, it } from "vitest";

import { shadowCarries, shadowPaints } from "@morph/morphShadow";

// Tailwind composes every shadow with four empty ring layers, so a box with no
// shadow at all still computes to a list that is not `none`.
const RINGS =
  "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, " +
  "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px";

describe("shadowPaints", () => {
  it("reads a stack of empty ring layers as nothing to cast", () => {
    // A carrier built for one of these would be an element and an animation
    // cast for a shadow nobody can see.
    expect(shadowPaints(RINGS)).toBe(false);
    expect(shadowPaints("none")).toBe(false);
    expect(shadowPaints("")).toBe(false);
  });

  it("reads a transparent colour and a zero geometry as nothing to cast", () => {
    expect(shadowPaints("rgba(0, 0, 0, 0) 0px 20px 25px -5px")).toBe(false);
    expect(shadowPaints("rgb(0 0 0 / 0) 0px 4px 8px")).toBe(false);
    expect(shadowPaints("rgb(15 23 42)")).toBe(false);
  });

  it("reads a real shadow, in any of the ways an engine writes one", () => {
    expect(shadowPaints("rgba(139, 92, 246, 0.2) 0px 20px 25px -5px")).toBe(true);
    expect(shadowPaints(`${RINGS}, oklab(0.6 0.09 -0.23 / 0.2) 0px 20px 25px -5px`)).toBe(true);
    // A layer whose colour the engine left off: the lengths decide.
    expect(shadowPaints("0px 4px 8px")).toBe(true);
  });
});

describe("shadowCarries", () => {
  it("carries a shadow that paints outside the box", () => {
    expect(shadowCarries("rgba(139, 92, 246, 0.2) 0px 20px 25px -5px")).toBe(true);
    expect(shadowCarries(RINGS)).toBe(true);
    expect(shadowCarries("none")).toBe(true);
  });

  it("refuses an INSET shadow, which paints against the revealed box itself", () => {
    // The carrier sits under the element, and the revealed border box is the
    // larger end, so an inset shadow is drawn against the wrong rectangle and
    // nothing outside the element can put it right.
    expect(shadowCarries("rgba(0, 0, 0, 0.2) 0px 4px 12px inset")).toBe(false);
    expect(shadowCarries(`${RINGS}, rgba(0, 0, 0, 0.2) 0px 4px 12px 0px inset`)).toBe(false);
  });

  it("ignores an inset layer that paints nothing", () => {
    expect(shadowCarries("rgba(0, 0, 0, 0) 0px 0px 0px 0px inset")).toBe(true);
  });
});
