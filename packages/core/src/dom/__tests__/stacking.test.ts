import { describe, expect, it } from "vitest";

import {
  CHROME_LEVEL,
  CONTENT_LEVEL,
  DECORATOR_LEVEL,
  OVERLAY_LEVEL,
  SCREEN_STACKING_ORDER
} from "@dom/stacking";

// The stacking table is only worth having if the RELATIONS in it are what get
// asserted. A test that repeats the numbers pins nothing: it passes just as
// happily on a table where the decorator sank below the overlay, because it
// would have been edited in the same commit.

describe("the stacking contract inside one screen", () => {
  it("orders chrome under an overlay under the dim", () => {
    expect(CHROME_LEVEL).toBeLessThan(OVERLAY_LEVEL);
    // The one that is easy to get backwards, and invisible until a covered
    // screen darkens with a bright sheet still sitting on it.
    expect(OVERLAY_LEVEL).toBeLessThan(DECORATOR_LEVEL);
  });

  it("leaves the screen's own content at the browser's default", () => {
    // Content is not given a number on purpose: a screen's scope is in flow,
    // and every level above it is a positioned sibling, so the default already
    // puts them over it. Naming a level here would hand consumers a number to
    // out-bid.
    expect(CONTENT_LEVEL).toBe("auto");
  });

  it("keeps the readable order and the constants the same table", () => {
    expect(SCREEN_STACKING_ORDER.map((entry) => entry.role)).toEqual([
      "chrome",
      "overlay",
      "decorator"
    ]);
    expect(SCREEN_STACKING_ORDER.map((entry) => entry.level)).toEqual([
      CHROME_LEVEL,
      OVERLAY_LEVEL,
      DECORATOR_LEVEL
    ]);
    // Strictly ascending, whatever the numbers become.
    const levels = SCREEN_STACKING_ORDER.map((entry) => entry.level);
    expect(levels).toEqual([...levels].sort((left, right) => left - right));
    expect(new Set(levels).size).toBe(levels.length);
  });
});
