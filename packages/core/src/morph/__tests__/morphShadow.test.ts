import { describe, expect, it } from "vitest";

import { pairShadowFilters, shadowAsFilter, shadowPaints } from "@morph/morphShadow";

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

  it("takes a tightening spread out of the OFFSET, so the shadow stays soft", () => {
    // A shadow reaches `offset + spread + blur / 2` past the edge it is cast
    // towards. Tailwind's xl is 20px down, 25px of blur, pulled back 5px, which
    // reaches 27.5px; the same reach with no spread is 15px down and the blur
    // untouched. Folded into the blur instead it would be a 15px blur, and its
    // second layer would come out at a blur of ZERO, which is a hard band.
    expect(shadowAsFilter("rgba(139, 92, 246, 0.2) 0px 20px 25px -5px")).toBe(
      "drop-shadow(0px 15px 25px rgba(139, 92, 246, 0.2))"
    );
    expect(shadowAsFilter("rgb(0, 0, 0) 0px 8px 10px -6px")).toBe(
      "drop-shadow(0px 2px 10px rgb(0, 0, 0))"
    );
    // Cast upwards, the offset moves the other way.
    expect(shadowAsFilter("rgb(0, 0, 0) 0px -20px 25px -5px")).toBe(
      "drop-shadow(0px -15px 25px rgb(0, 0, 0))"
    );
  });

  it("grows a spreading shadow through the blur, which is the only side an offset cannot reach", () => {
    expect(shadowAsFilter("rgb(0, 0, 0) 0px 2px 4px 3px")).toBe(
      "drop-shadow(0px 2px 10px rgb(0, 0, 0))"
    );
  });

  it("takes a spread out of the blur where there is no offset to take it out of", () => {
    expect(shadowAsFilter("rgb(0, 0, 0) 0px 0px 12px -4px")).toBe(
      "drop-shadow(0px 0px 4px rgb(0, 0, 0))"
    );
    // And never asks for a negative radius.
    expect(shadowAsFilter("rgb(0, 0, 0) 0px 0px 4px -8px")).toBe(
      "drop-shadow(0px 0px 0px rgb(0, 0, 0))"
    );
    // A spread that swallows the offset AND the blur reaches nowhere: the
    // shadow was entirely behind the box to begin with.
    expect(shadowAsFilter("rgb(0, 0, 0) 0px 2px 8px -6px")).toBe(
      "drop-shadow(0px 0px 0px rgb(0, 0, 0))"
    );
  });

  it("carries every layer that paints, in order, and drops the ones that do not", () => {
    expect(
      shadowAsFilter(
        `${RINGS}, rgba(139, 92, 246, 0.2) 0px 20px 25px -5px, rgb(0, 0, 0) 0px 8px 10px -6px`
      )
    ).toBe(
      "drop-shadow(0px 15px 25px rgba(139, 92, 246, 0.2)) drop-shadow(0px 2px 10px rgb(0, 0, 0))"
    );
  });

  it("reads a layer whose colour the engine left off", () => {
    // An engine may report the colour as the page's own `color`, leaving the
    // layer as lengths alone. There is then no colour to hand the filter, and a
    // drop-shadow without one takes the element's `color`, which is the same
    // rule the shadow was following.
    expect(shadowAsFilter("0px 4px 8px")).toBe("drop-shadow(0px 4px 8px)");
  });

  it("pairs two ends to the same shape, so the filter can interpolate at all", () => {
    // A filter interpolates function by function, so two lists of different
    // lengths do not interpolate: the browser swaps one for the other halfway
    // and the shadow jumps. Tailwind's xl paints two layers and its 2xl paints
    // one, which is exactly the pair a card flies between.
    const paired = pairShadowFilters(
      `${RINGS}, rgba(139, 92, 246, 0.2) 0px 20px 25px -5px, rgba(139, 92, 246, 0.2) 0px 8px 10px -6px`,
      `${RINGS}, rgba(139, 92, 246, 0.25) 0px 25px 50px -12px`
    );

    expect(paired.from.match(/drop-shadow/g)).toHaveLength(2);
    expect(paired.to.match(/drop-shadow/g)).toHaveLength(2);
    // The padding casts nothing, so the end it was added to looks unchanged.
    expect(paired.to).toContain("drop-shadow(0px 0px 0px rgba(0, 0, 0, 0))");
  });

  it("pairs two ends that cast nothing as nothing", () => {
    expect(pairShadowFilters(RINGS, "none")).toEqual({ from: "none", to: "none" });
  });

  it("pairs an end that casts nothing against one that does", () => {
    // A card that gains a shadow on the way grows it from one that casts
    // nothing rather than having it appear halfway.
    const paired = pairShadowFilters("none", "rgb(0, 0, 0) 0px 4px 8px");

    expect(paired.from).toBe("drop-shadow(0px 0px 0px rgba(0, 0, 0, 0))");
    expect(paired.to).toBe("drop-shadow(0px 4px 8px rgb(0, 0, 0))");
  });

  it("says whether a computed shadow paints at all", () => {
    expect(shadowPaints(RINGS)).toBe(false);
    expect(shadowPaints("none")).toBe(false);
    expect(shadowPaints("rgba(139, 92, 246, 0.2) 0px 20px 25px -5px")).toBe(true);
  });
});
