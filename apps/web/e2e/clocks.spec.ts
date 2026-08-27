import { expect, test } from "@playwright/test";

import { cupertino, layout, material, none } from "@flemo/core";

import { CLOCKS } from "../app/[lang]/playground/_transitions/clocks";

// THE PLAYGROUND'S CLOCK TABLE, checked against the presets it copies.
//
// `clocks.ts` mirrors flemo's own durations and curves so that every <Part> the
// playground authors can be generated on the transition's clock rather than a
// constant of its own. A mirror is a thing that drifts: if a preset is retimed
// in `packages/core` and this table is not, the playground goes back to the
// desync it was rebuilt to remove — chrome that finishes its hand-over while
// the screens still have travel left.
//
// BOTH DIRECTIONS ARE ASSERTED, and that is not thoroughness for its own sake.
// The first version of this spec checked the push variant only, and passed over
// a table that carried one duration per preset. `material` enters in 0.35s and
// pops in 0.25s, so every part in the playground ran 40% too slow on every
// material pop — caught by driving the app, not by this file, which is why the
// pop row is here now.
const presets = { cupertino, material, layout, none };

// The variants a push and a pop actually play. Both screens in a push run the
// push pair; both in a pop run the pop pair. The split is by DIRECTION, not by
// which side of the flight a screen is on.
const PUSH = "PUSHING-true" as const;
const POP = "POPPING-true" as const;

test.describe("playground clock table", () => {
  for (const [name, preset] of Object.entries(presets)) {
    test(`${name} matches the preset it mirrors, both directions`, () => {
      const row = CLOCKS[name];
      expect(row, `no clock row for the ${name} preset`).toBeDefined();

      expect(row!.push.duration, `${name} push duration`).toBe(
        preset.variants[PUSH].options?.duration ?? 0
      );
      expect(row!.pop.duration, `${name} pop duration`).toBe(
        preset.variants[POP].options?.duration ?? 0
      );
    });
  }

  test("material is the asymmetric one, and the table says so", () => {
    // Pinned explicitly because it is the case that broke: a table that
    // collapsed both directions into one number looked correct in review and
    // desynced every pop.
    expect(CLOCKS.material!.push.duration).toBe(0.35);
    expect(CLOCKS.material!.pop.duration).toBe(0.25);
  });

  test("every row a bench can select has a clock", () => {
    // The two the site authors itself have no preset to mirror, so their rows
    // are the definition rather than a copy. They still have to EXIST, because
    // a transition selectable without a row would silently fall back to another
    // transition's timing.
    expect(Object.keys(CLOCKS).sort()).toEqual(
      ["cupertino", "fade", "layout", "material", "none", "sheet"].sort()
    );
  });

  test("a cut is a zero clock, not a short one", () => {
    // `none` is the case that catches a table maintained by feel: anything
    // riding an instant screen change has to cut with it, and a bar that
    // cross-fades over a cut is the same desync inverted.
    expect(CLOCKS.none!.push.duration).toBe(0);
    expect(CLOCKS.none!.pop.duration).toBe(0);
  });
});
