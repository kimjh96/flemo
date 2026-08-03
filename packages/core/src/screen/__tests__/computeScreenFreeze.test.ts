import { describe, expect, it } from "vitest";

import computeScreenFreeze, {
  computeScreenFreezeMode,
  resetShallowFreezeForTesting,
  type ScreenFreezeInput
} from "@screen/computeScreenFreeze";

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

describe("computeScreenFreezeMode", () => {
  const base = {
    isActive: false,
    isPrev: false,
    zIndex: 3,
    index: 4,
    status: "COMPLETED" as const,
    dragStatus: "IDLE" as const,
    replaceTransitionStatus: "IDLE" as const
  };

  it("the just-covered prev at rest is DEFERRED (its freeze races the settling eye)", () => {
    expect(computeScreenFreezeMode(base)).toBe("deferred");
  });

  it("a deep screen is IMMEDIATE regardless of transition status", () => {
    expect(computeScreenFreezeMode({ ...base, isPrev: true, zIndex: 2, status: "PUSHING" })).toBe(
      "immediate"
    );
    expect(computeScreenFreezeMode({ ...base, isPrev: true, zIndex: 0, status: "PUSHING" })).toBe(
      "immediate"
    );
  });

  it("a participant is LIVE: the active screen, a transitioning prev, the replace guard", () => {
    expect(computeScreenFreezeMode({ ...base, isActive: true })).toBe("live");
    expect(computeScreenFreezeMode({ ...base, status: "PUSHING" })).toBe("live");
    expect(
      computeScreenFreezeMode({
        ...base,
        isPrev: true,
        zIndex: 2,
        replaceTransitionStatus: "PENDING",
        status: "REPLACING"
      })
    ).toBe("live");
  });

  it("the boolean view mirrors the mode", () => {
    expect(computeScreenFreeze(base)).toBe(true);
    expect(computeScreenFreeze({ ...base, isActive: true })).toBe(false);
  });
});

describe("shallow-freeze diagnostic", () => {
  it("keeps the DIRECT prev live while deep screens still freeze", () => {
    sessionStorage.setItem("flemo:freeze", "shallow");
    resetShallowFreezeForTesting();
    try {
      // The just-covered direct prev at rest: normally "deferred" — armed,
      // it stays live so a pop never pays the wake + layer re-creation.
      expect(
        computeScreenFreezeMode({
          ...base,
          isActive: false,
          isPrev: false,
          status: "COMPLETED",
          dragStatus: "IDLE"
        })
      ).toBe("live");
      // A DEEP screen keeps freezing — the O(depth) storm protection stays.
      expect(
        computeScreenFreezeMode({
          ...base,
          isPrev: true,
          zIndex: 0,
          index: 3
        })
      ).toBe("immediate");
    } finally {
      sessionStorage.removeItem("flemo:freeze");
      resetShallowFreezeForTesting();
    }
  });
});
