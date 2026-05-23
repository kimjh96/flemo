import { describe, expect, it } from "vitest";

import { consumeSelfInducedPop, markSelfInducedPop } from "@navigate/selfPopGuard";

describe("selfPopGuard", () => {
  it("returns false when nothing was marked", () => {
    expect(consumeSelfInducedPop()).toBe(false);
  });

  it("consumes exactly one mark per call", () => {
    markSelfInducedPop();
    markSelfInducedPop();

    expect(consumeSelfInducedPop()).toBe(true);
    expect(consumeSelfInducedPop()).toBe(true);
    expect(consumeSelfInducedPop()).toBe(false);
  });
});
