import { describe, expect, it } from "vitest";

import computeScreenFreeze, { type ScreenFreezeInput } from "@screen/computeScreenFreeze";

const base: ScreenFreezeInput = {
  isActive: false,
  isPrev: false,
  zIndex: 0,
  index: 1,
  status: "COMPLETED",
  dragStatus: "IDLE",
  replaceTransitionStatus: "IDLE"
};

describe("computeScreenFreeze", () => {
  it("does not freeze the active screen", () => {
    expect(computeScreenFreeze({ ...base, isActive: true })).toBe(false);
  });

  it("freezes an inactive screen once its transition has settled", () => {
    expect(computeScreenFreeze({ ...base, isActive: false, status: "COMPLETED" })).toBe(true);
  });

  it("does not freeze an inactive screen mid-transition", () => {
    expect(computeScreenFreeze({ ...base, isActive: false, status: "PUSHING" })).toBe(false);
  });

  it("does not freeze while a drag is in progress", () => {
    expect(computeScreenFreeze({ ...base, isActive: false, dragStatus: "PENDING" })).toBe(false);
  });

  it("freezes a covered prev screen (index - 2 >= zIndex) when not replacing", () => {
    // isPrev, index 3, zIndex 1 → index-2 (1) <= zIndex (1), replace IDLE → frozen
    expect(
      computeScreenFreeze({ ...base, isActive: true, isPrev: true, index: 3, zIndex: 1 })
    ).toBe(true);
  });

  it("keeps the just-below prev unfrozen during a replace flip", () => {
    // isPrev, index 3, zIndex 1, replace PENDING → second clause false; active so first false → not frozen
    expect(
      computeScreenFreeze({
        ...base,
        isActive: true,
        isPrev: true,
        index: 3,
        zIndex: 1,
        replaceTransitionStatus: "PENDING"
      })
    ).toBe(false);
  });

  it("always freezes a deep prev screen (index - 2 > zIndex)", () => {
    // isPrev, index 4, zIndex 1 → index-2 (2) > zIndex (1) → frozen regardless of replace status
    expect(
      computeScreenFreeze({
        ...base,
        isActive: true,
        isPrev: true,
        index: 4,
        zIndex: 1,
        replaceTransitionStatus: "PENDING"
      })
    ).toBe(true);
  });
});
