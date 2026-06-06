import { afterEach, describe, expect, it } from "vitest";

import { consumeSelfInducedPop, markSelfInducedPop } from "@navigate/selfPopGuard";

const drain = () => {
  while (consumeSelfInducedPop()) {
    /* drain remaining marks so test cases stay isolated */
  }
};

describe("selfPopGuard", () => {
  afterEach(drain);

  it("returns false when nothing was marked", () => {
    expect(consumeSelfInducedPop()).toBe(false);
  });

  it("consumes exactly one mark per call (FIFO counter)", () => {
    markSelfInducedPop();
    markSelfInducedPop();

    expect(consumeSelfInducedPop()).toBe(true);
    expect(consumeSelfInducedPop()).toBe(true);
    expect(consumeSelfInducedPop()).toBe(false);
  });

  it("repeated mark-and-consume cycles stay independent", () => {
    markSelfInducedPop();
    expect(consumeSelfInducedPop()).toBe(true);
    expect(consumeSelfInducedPop()).toBe(false);

    markSelfInducedPop();
    markSelfInducedPop();
    markSelfInducedPop();
    expect(consumeSelfInducedPop()).toBe(true);
    expect(consumeSelfInducedPop()).toBe(true);
    expect(consumeSelfInducedPop()).toBe(true);
    expect(consumeSelfInducedPop()).toBe(false);
  });

  it("a partial consume leaves the remainder available for later", () => {
    markSelfInducedPop();
    markSelfInducedPop();
    expect(consumeSelfInducedPop()).toBe(true);
    // 1 mark remains in flight. Should still resolve on the next call.
    expect(consumeSelfInducedPop()).toBe(true);
    expect(consumeSelfInducedPop()).toBe(false);
  });
});
