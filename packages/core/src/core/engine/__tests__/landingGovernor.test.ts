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
