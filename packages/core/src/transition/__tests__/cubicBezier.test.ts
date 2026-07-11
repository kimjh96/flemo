import { describe, expect, it } from "vitest";

import { cubicBezier, resolveEasing } from "@transition/cubicBezier";

describe("cubicBezier", () => {
  it("anchors the endpoints exactly", () => {
    const ease = cubicBezier(0.32, 0.72, 0, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(-0.5)).toBe(0);
    expect(ease(1.5)).toBe(1);
  });

  it("solves the cupertino curve monotonically with a fast start", () => {
    const ease = cubicBezier(0.32, 0.72, 0, 1);
    let previous = 0;
    for (let i = 1; i <= 20; i++) {
      const value = ease(i / 20);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
    // Decelerating curve: half the time covers well over half the distance.
    expect(ease(0.5)).toBeGreaterThan(0.8);
  });

  it("matches the CSS solver on a straight line", () => {
    const linearish = cubicBezier(0.25, 0.25, 0.75, 0.75);
    for (const t of [0.1, 0.33, 0.5, 0.77]) {
      expect(linearish(t)).toBeCloseTo(t, 5);
    }
  });

  it("resolves named eases, arrays, and fallbacks", () => {
    expect(resolveEasing("linear")(0.3)).toBe(0.3);
    expect(resolveEasing([0.32, 0.72, 0, 1])(0.5)).toBeCloseTo(cubicBezier(0.32, 0.72, 0, 1)(0.5));
    // Named ease maps to its control points.
    expect(resolveEasing("easeInOut")(0.5)).toBeCloseTo(0.5, 2);
    // Unknown / invalid inputs fall back without throwing.
    expect(resolveEasing("mystery" as never)(1)).toBe(1);
    expect(resolveEasing([1, 2] as never)(0.4)).toBe(0.4);
    expect(resolveEasing(undefined)(0)).toBe(0);
  });
});
