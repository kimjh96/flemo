import { describe, expect, it } from "vitest";

import initialHidesScreen from "@transition/initialHidesScreen";

describe("initialHidesScreen", () => {
  it("is hidden when fully transparent", () => {
    expect(initialHidesScreen({ opacity: 0 })).toBe(true);
  });

  it("is hidden when translated off-screen by at least 100%", () => {
    expect(initialHidesScreen({ x: "100%" })).toBe(true);
    expect(initialHidesScreen({ y: "-100%" })).toBe(true);
    expect(initialHidesScreen({ x: "120%" })).toBe(true);
  });

  it("is not hidden for a partial fade or scale that stays on-screen", () => {
    expect(initialHidesScreen({ opacity: 0.97 })).toBe(false);
    expect(initialHidesScreen({ scale: 0.95 })).toBe(false);
    expect(initialHidesScreen({ x: "50%" })).toBe(false);
  });

  it("is not hidden for an empty or absent initial", () => {
    expect(initialHidesScreen(undefined)).toBe(false);
    expect(initialHidesScreen({})).toBe(false);
  });

  it("treats non-percent translate units conservatively as not hidden", () => {
    expect(initialHidesScreen({ x: 500 })).toBe(false);
    expect(initialHidesScreen({ x: "100px" })).toBe(false);
  });
});
