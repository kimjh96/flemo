import { describe, expect, it } from "vitest";

import type { VariantMotion } from "@transition/variantMotion";

import { governedEasingForMotion } from "@core/engine/landingGovernor";

// The landing governor (landingGovernor.ts): the compiled animation's easing
// reshaped into a CSS linear() that follows the authored curve until its
// velocity drops below one device pixel per frame inside the engagement
// range, then sprints the remainder at exactly that velocity and rests early.
// ONE animation, still compositor-driven (an overlaid second animation was
// traced demoting the whole flight to the main thread: Animation
// compositeFailed=64, kTargetHasIncompatibleAnimations).

describe("governedEasingForMotion", () => {
  const box = { clientWidth: 1400, clientHeight: 800 } as unknown as HTMLElement;
  const cupertino = {
    from: { x: "100%" },
    to: { x: 0 },
    duration: 0.7,
    delay: 0,
    ease: [0.32, 0.72, 0, 1]
  } as VariantMotion;

  it("reshapes a flat-tailed slide into an early linear landing", () => {
    const easing = governedEasingForMotion(cupertino, box, 1, 1000 / 120);
    expect(easing).toMatch(/^linear\(/);
    // The reshaped curve reaches 1 strictly before 100% and holds it.
    const match = /1 (\d+\.?\d*)%, 1 100%\)$/.exec(easing!);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1]!)).toBeLessThan(100);
    expect(parseFloat(match![1]!)).toBeGreaterThan(80);
  });

  it("bails on non-translation channels and tiny motions", () => {
    expect(
      governedEasingForMotion(
        {
          ...cupertino,
          from: { x: "100%", opacity: 0 },
          to: { x: 0, opacity: 1 }
        } as VariantMotion,
        box,
        1,
        1000 / 120
      )
    ).toBeNull();
    expect(
      governedEasingForMotion({ ...cupertino, from: { x: 8 } } as VariantMotion, box, 1, 1000 / 120)
    ).toBeNull();
  });

  it("preserves an overshooting ease", () => {
    const bounce = { ...cupertino, ease: [0.34, 1.56, 0.64, 1] } as VariantMotion;
    expect(governedEasingForMotion(bounce, box, 1, 1000 / 120)).toBeNull();
  });

  it("bails on a non-positive duration or an unusable frame interval", () => {
    expect(governedEasingForMotion({ ...cupertino, duration: 0 }, box, 1, 1000 / 120)).toBeNull();
    expect(governedEasingForMotion(cupertino, box, 1, 0)).toBeNull();
    expect(governedEasingForMotion(cupertino, box, 1, Number.NaN)).toBeNull();
  });

  it("a constant channel coexisting with the travel does not veto", () => {
    const withConstant = {
      ...cupertino,
      from: { x: "100%", opacity: 1 },
      to: { x: 0, opacity: 1 }
    } as VariantMotion;
    expect(governedEasingForMotion(withConstant, box, 1, 1000 / 120)).toMatch(/^linear\(/);
  });
});

// Bail paths. Each is a deliberate conservatism — the governor reshapes the
// ONE animation every channel of the flight rides, so anything it cannot
// reason about must leave the authored easing alone rather than guess.
describe("governedEasingForMotion bails", () => {
  const box = { clientWidth: 1400, clientHeight: 800 } as unknown as HTMLElement;
  const slide = {
    from: { x: "100%" },
    to: { x: 0 },
    duration: 0.7,
    delay: 0,
    ease: [0.32, 0.72, 0, 1]
  } as VariantMotion;

  it("treats a nonsensical device-pixel ratio as 1 rather than refusing", () => {
    // A zero/NaN/negative dpr is an embedder quirk, not a reason to drop the
    // landing: the reshape is still correct at 1.
    for (const dpr of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(governedEasingForMotion(slide, box, dpr, 1000 / 120)).toBe(
        governedEasingForMotion(slide, box, 1, 1000 / 120)
      );
    }
  });

  it("bails when a target is missing or is not an object", () => {
    expect(
      governedEasingForMotion({ ...slide, from: null } as unknown as VariantMotion, box, 1, 8.3)
    ).toBeNull();
    expect(
      governedEasingForMotion({ ...slide, to: "0" } as unknown as VariantMotion, box, 1, 8.3)
    ).toBeNull();
  });

  it("bails when a channel's endpoint cannot be resolved to a number", () => {
    expect(
      governedEasingForMotion(
        { ...slide, from: { x: "calc(100% - 3em)" } } as unknown as VariantMotion,
        box,
        1,
        8.3
      )
    ).toBeNull();
  });

  it("bails when the curve is slow from the very first frame", () => {
    // A linear crawl is under one device pixel per frame throughout, so the
    // engagement point walks back to 0 — there is no fast phase to preserve.
    expect(
      governedEasingForMotion(
        { ...slide, duration: 40, ease: [0, 0, 1, 1] } as VariantMotion,
        box,
        1,
        1000 / 120
      )
    ).toBeNull();
  });

  it("bails when the remaining travel is outside the engagement range", () => {
    // Above the range there is still real motion to play; at or below one
    // device pixel there is nothing left to govern.
    const wide = { clientWidth: 20000, clientHeight: 800 } as unknown as HTMLElement;
    expect(governedEasingForMotion(slide, wide, 1, 1000 / 120)).toBeNull();
    expect(
      governedEasingForMotion({ ...slide, ease: [0, 0, 1, 1] } as VariantMotion, box, 1, 1000 / 120)
    ).toBeNull();
  });

  it("never emits a negative zero, however the curve undershoots", () => {
    const undershoot = { ...slide, ease: [0.05, -0.8, 0, 1] } as VariantMotion;
    const easing = governedEasingForMotion(undershoot, box, 1, 1000 / 120);
    expect(easing).not.toBeNull();
    expect(easing).not.toMatch(/(^|[,(])\s*-0[ ,)]/);
  });

  it("bails once the tail is already inside a device pixel", () => {
    // Three ways to arrive there: a narrow box, a short slide, and a slow
    // cadence. In each the engagement point lands with under one device pixel
    // to go, so there is nothing left for the governor to close.
    const narrow = { clientWidth: 390, clientHeight: 800 } as unknown as HTMLElement;
    expect(governedEasingForMotion(slide, narrow, 1, 1000 / 120)).toBeNull();
    expect(
      governedEasingForMotion({ ...slide, duration: 0.2 } as VariantMotion, box, 1, 1000 / 120)
    ).toBeNull();
    expect(governedEasingForMotion(slide, box, 1, 1000 / 30)).toBeNull();
  });
});
