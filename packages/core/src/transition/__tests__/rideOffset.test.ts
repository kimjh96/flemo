import { describe, expect, it } from "vitest";

import {
  percentRatio,
  resolveRideTarget,
  rideLength,
  RIDE_HEIGHT_VAR
} from "@transition/rideOffset";

describe("percentRatio", () => {
  it("reads a bare percentage as a fraction", () => {
    expect(percentRatio("100%")).toBe(1);
    expect(percentRatio("-30%")).toBe(-0.3);
    expect(percentRatio(" 12.5% ")).toBe(0.125);
  });

  it("returns null for everything a rider must pass through untouched", () => {
    expect(percentRatio(0)).toBeNull();
    expect(percentRatio(-56)).toBeNull();
    expect(percentRatio("56px")).toBeNull();
    expect(percentRatio("calc(100% - 8px)")).toBeNull();
    expect(percentRatio(undefined)).toBeNull();
  });

  it("returns null for a percentage that does not survive being a number", () => {
    // The pattern accepts any run of digits, and a long enough one parses to
    // Infinity. That would reach the keyframe as `calc(... * Infinity)` and
    // invalidate the whole declaration, taking the bar's motion with it.
    expect(percentRatio(`${"9".repeat(400)}%`)).toBeNull();
  });
});

describe("rideLength", () => {
  it("falls back to 100%, so an unpublished rider keeps today's distance", () => {
    expect(rideLength(1)).toBe(`var(${RIDE_HEIGHT_VAR}, 100%)`);
  });

  it("multiplies the published box for any other fraction", () => {
    expect(rideLength(-1)).toBe(`calc(var(${RIDE_HEIGHT_VAR}, 100%) * -1)`);
    expect(rideLength(-0.3)).toBe(`calc(var(${RIDE_HEIGHT_VAR}, 100%) * -0.3)`);
  });
});

describe("resolveRideTarget", () => {
  it("resolves a percentage y against the screen box", () => {
    expect(resolveRideTarget({ y: "100%" }, 770)).toEqual({ y: "770px" });
    expect(resolveRideTarget({ y: "-30%", opacity: 0 }, 770)).toEqual({ y: "-231px", opacity: 0 });
  });

  it("leaves x alone: a shared bar is already exactly as wide as its screen", () => {
    expect(resolveRideTarget({ x: "100%" }, 770)).toEqual({ x: "100%" });
  });

  it("returns the same object when there is nothing to resolve", () => {
    const target = { y: -56, opacity: 0 };
    expect(resolveRideTarget(target, 770)).toBe(target);
  });

  it("leaves the percentage in place when the screen box is unknown", () => {
    const target = { y: "100%" };
    expect(resolveRideTarget(target, 0)).toBe(target);
  });
});
