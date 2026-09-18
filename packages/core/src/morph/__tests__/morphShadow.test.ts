import { describe, expect, it } from "vitest";

import { shadowAsFilter, shadowPaints } from "@morph/morphShadow";

// Tailwind composes every shadow with four empty ring layers, so a box with no
// shadow at all still computes to a list that is not `none`.
const RINGS =
  "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, " +
  "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px";

describe("shadowAsFilter", () => {
  it("casts nothing where nothing paints", () => {
    expect(shadowAsFilter("none")).toBe("none");
    expect(shadowAsFilter("")).toBe("none");
    expect(shadowAsFilter(RINGS)).toBe("none");
    // A layer with a transparent colour, and one with no lengths at all.
    expect(shadowAsFilter("rgba(0, 0, 0, 0) 0px 20px 25px -5px")).toBe("none");
    expect(shadowAsFilter("rgb(0 0 0 / 0) 0px 4px 8px")).toBe("none");
  });

  it("folds the spread into the blur, because drop-shadow has no argument for it", () => {
    // A shadow reaches about half its blur past the box, plus its spread, so a
    // blur of `blur + 2 * spread` reaches the same distance with none. Tailwind's
    // xl shadow is 25px of blur pulled back 5px, which is 15px of blur alone.
    expect(shadowAsFilter("rgba(139, 92, 246, 0.2) 0px 20px 25px -5px")).toBe(
      "drop-shadow(0px 20px 15px rgba(139, 92, 246, 0.2))"
    );
    // And a spread that pushes out reaches further.
    expect(shadowAsFilter("rgb(0, 0, 0) 0px 2px 4px 3px")).toBe(
      "drop-shadow(0px 2px 10px rgb(0, 0, 0))"
    );
  });

  it("never asks for a negative blur", () => {
    // A spread pulled back further than the blur reaches would be a negative
    // radius, which is not a filter at all.
    expect(shadowAsFilter("rgb(0, 0, 0) 0px 2px 4px -8px")).toBe(
      "drop-shadow(0px 2px 0px rgb(0, 0, 0))"
    );
  });

  it("carries every layer that paints, in order, and drops the ones that do not", () => {
    expect(
      shadowAsFilter(
        `${RINGS}, rgba(139, 92, 246, 0.2) 0px 20px 25px -5px, rgb(0, 0, 0) 0px 8px 10px -6px`
      )
    ).toBe(
      "drop-shadow(0px 20px 15px rgba(139, 92, 246, 0.2)) drop-shadow(0px 8px 0px rgb(0, 0, 0))"
    );
  });

  it("reads a layer whose colour the engine left off", () => {
    // An engine may report the colour as the page's own `color`, leaving the
    // layer as lengths alone. There is then no colour to hand the filter, and a
    // drop-shadow without one takes the element's `color`, which is the same
    // rule the shadow was following.
    expect(shadowAsFilter("0px 4px 8px")).toBe("drop-shadow(0px 4px 8px)");
  });

  it("says whether a computed shadow paints at all", () => {
    expect(shadowPaints(RINGS)).toBe(false);
    expect(shadowPaints("none")).toBe(false);
    expect(shadowPaints("rgba(139, 92, 246, 0.2) 0px 20px 25px -5px")).toBe(true);
  });
});
