import { expect, test } from "@playwright/test";

import { cupertino, layout, material, none } from "@flemo/core";

import { CLOCKS } from "../app/[lang]/playground/_transitions/clocks";

// THE PLAYGROUND'S CLOCK TABLE, checked against the presets it copies.
//
// `clocks.ts` mirrors flemo's own durations and curves so that every <Part> the
// playground authors can be generated on the transition's clock rather than a
// constant of its own. A mirror is a thing that drifts: if a preset is retimed
// in `packages/core` and this table is not, the playground goes back to exactly
// the desync it was rebuilt to remove — a bar that finishes its hand-over while
// the screens still have half their travel left.
//
// Which is invisible in review and obvious under measurement, so it is asserted
// here instead. This spec drives no browser; it reads the published preset
// objects directly.
const presets = { cupertino, material, layout, none };

// The variant every screen plays when it is the one arriving. The parts ride
// the arrival, so this is the clock they have to match.
const ENTER = "PUSHING-true" as const;

test.describe("playground clock table", () => {
  for (const [name, preset] of Object.entries(presets)) {
    test(`${name} matches the preset it mirrors`, () => {
      const row = CLOCKS[name];
      expect(row, `no clock row for the ${name} preset`).toBeDefined();

      const options = preset.variants[ENTER].options;
      expect(row!.duration).toBe(options?.duration ?? 0);
    });
  }

  test("every row a bench can select has a clock", () => {
    // The two the site authors itself have no preset to mirror, so their rows
    // are the definition rather than a copy. They still have to EXIST, because
    // a transition selectable in the bench without a row would silently fall
    // back to another transition's timing.
    expect(Object.keys(CLOCKS).sort()).toEqual(
      ["cupertino", "fade", "layout", "material", "none", "sheet"].sort()
    );
  });

  test("a cut is a zero clock, not a short one", () => {
    // `none` is the case that catches a table maintained by feel: anything
    // riding an instant screen change has to cut with it, and a bar that
    // cross-fades over a cut is the same desync inverted.
    expect(CLOCKS.none!.duration).toBe(0);
  });
});
