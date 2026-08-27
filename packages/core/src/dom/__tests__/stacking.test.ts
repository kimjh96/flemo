import { describe, expect, it } from "vitest";

import { OVERLAY_LEVEL, SCREEN_STACKING_ORDER, UNNUMBERED_LEVEL } from "@dom/stacking";

// The table is only worth having if what gets asserted is the REASONING, not
// the numbers. A test that repeats them pins nothing: it passes just as
// happily on a table edited in the same commit.
//
// The reasoning here is mostly a refusal. Numbering flemo's own chrome reads
// as tidier and is a regression, because a consumer's positioned content and
// flemo's nested screen containers leak their z-indexes into the same context
// and used to outrank chrome at `auto`.

describe("the stacking contract inside one screen", () => {
  it("leaves everything but the overlay unnumbered", () => {
    const numbered = SCREEN_STACKING_ORDER.filter((entry) => entry.level !== UNNUMBERED_LEVEL);

    expect(numbered.map((entry) => entry.role)).toEqual(["overlay"]);
    expect(UNNUMBERED_LEVEL).toBe("auto");
  });

  it("puts the overlay above any screen stack this context can hold", () => {
    // A screen container numbers itself by stack position plus one, so the
    // ceiling the overlay has to clear is a navigation depth. Two overlapping
    // at 2 was the first attempt, and a stack two screens deep already beat it.
    expect(typeof OVERLAY_LEVEL).toBe("number");
    expect(OVERLAY_LEVEL).toBeGreaterThan(1000);
  });

  it("names the roles in paint order", () => {
    expect(SCREEN_STACKING_ORDER.map((entry) => entry.role)).toEqual([
      "content",
      "chrome",
      "decorator",
      "overlay"
    ]);
  });
});
