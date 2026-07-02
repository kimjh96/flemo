import { describe, expect, it } from "vitest";

import computeBarRiding, { type BarRidingInput } from "@screen/computeBarRiding";

describe("computeBarRiding", () => {
  const base: BarRidingInput = {
    status: "POPPING",
    isTopOrTopPrev: true,
    hasTopBar: true,
    hasNavBar: true,
    partnerBars: undefined
  };

  it("rides each bar the partner does not own", () => {
    expect(computeBarRiding(base)).toEqual({ app: true, nav: true });
  });

  it("does not ride a bar the partner owns (it hands over seamlessly)", () => {
    expect(computeBarRiding({ ...base, partnerBars: { topBar: true, bottomBar: false } })).toEqual({
      app: false,
      nav: true
    });
    expect(computeBarRiding({ ...base, partnerBars: { topBar: false, bottomBar: true } })).toEqual({
      app: true,
      nav: false
    });
  });

  it("rides nothing when not transitioning", () => {
    expect(computeBarRiding({ ...base, status: "COMPLETED" })).toEqual({ app: false, nav: false });
    expect(computeBarRiding({ ...base, status: "IDLE" })).toEqual({ app: false, nav: false });
  });

  it("rides nothing when the screen is neither the top nor the top's prev", () => {
    expect(computeBarRiding({ ...base, isTopOrTopPrev: false })).toEqual({
      app: false,
      nav: false
    });
  });

  it("only rides bars the screen actually has", () => {
    expect(computeBarRiding({ ...base, hasTopBar: false })).toEqual({ app: false, nav: true });
    expect(computeBarRiding({ ...base, hasNavBar: false })).toEqual({ app: true, nav: false });
  });

  it("rides during push and replace, not only pop", () => {
    expect(computeBarRiding({ ...base, status: "PUSHING" })).toEqual({ app: true, nav: true });
    expect(computeBarRiding({ ...base, status: "REPLACING" })).toEqual({ app: true, nav: true });
  });
});
