import { describe, expect, it } from "vitest";

import { capturePaint, paintTravel } from "@morph/morphPaint";

// WHAT THE TWO ENDS PAINT DIFFERENTLY.
//
// The arriving element is the destination's tree, so on the flight's first
// frame it already wears the destination's corner, surface and border — each
// one steps at the instant of the tap and then holds while only the box moves.
// This table is what carries them instead, and it is a TABLE precisely because
// the alternative was fixing one property at a time as each was spotted on
// glass: a list only ever as complete as the last thing someone noticed.

describe("capturePaint", () => {
  it("reads a channel from the computed style key it actually lives under", () => {
    expect(capturePaint({ borderRadius: "12px", backgroundColor: "rgb(0, 0, 0)" })).toMatchObject({
      "border-radius": "12px",
      "background-color": "rgb(0, 0, 0)"
    });
  });

  it("joins a multi-side channel in one value", () => {
    expect(
      capturePaint({
        borderTopWidth: "1px",
        borderRightWidth: "2px",
        borderBottomWidth: "3px",
        borderLeftWidth: "4px"
      })["border-width"]
    ).toBe("1px 2px 3px 4px");
  });

  it("skips a channel neither end declares", () => {
    // An absent value is not a value to animate from — and an empty string in
    // a keyframe is a parse error that takes the whole rule with it.
    const paint = capturePaint({ borderRadius: "   " });
    expect(paint["border-radius"]).toBeUndefined();
    expect(paint["box-shadow"]).toBeUndefined();
  });

  it("captures nothing where there are no computed styles to read", () => {
    expect(capturePaint(null)).toEqual({});
    expect(capturePaint(undefined)).toEqual({});
  });

  it("captures an unset gap as 0px so the channel interpolates", () => {
    // An unset flex/grid gap computes to the keyword `normal`, and
    // `normal → 12px` has no midpoint: CSS swaps it discretely at the eased
    // 50%, which landed the playground row's two gaps in a single mid-flight
    // frame — +12px into the label's left edge, −24px off its width. As 0px
    // the channel is numeric and rides the paint animation like everything
    // else. A declared length is left exactly as captured.
    expect(capturePaint({ rowGap: "normal", columnGap: "normal" })).toMatchObject({
      "row-gap": "0px",
      "column-gap": "0px"
    });
    expect(capturePaint({ rowGap: "8px", columnGap: "12px" })).toMatchObject({
      "row-gap": "8px",
      "column-gap": "12px"
    });
  });
});

describe("paintTravel", () => {
  it("animates only what is present at both ends and different", () => {
    const travel = paintTravel(
      { "border-radius": "12px", color: "rgb(0, 0, 0)", "box-shadow": "none" },
      { "border-radius": "24px", color: "rgb(0, 0, 0)" }
    );

    expect(travel).toEqual([{ property: "border-radius", from: "12px", to: "24px" }]);
  });

  it("lets a transition opt a channel out", () => {
    // The built-in `text` preset turns the corner off: type has no corner
    // worth moving.
    const ends = [{ "border-radius": "12px" }, { "border-radius": "24px" }] as const;
    expect(paintTravel(ends[0], ends[1], new Set(["border-radius"]))).toEqual([]);
  });
});
