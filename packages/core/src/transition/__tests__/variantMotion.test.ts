import { describe, expect, it } from "vitest";

import cupertino from "@transition/cupertino";
import {
  FROM_VARIANT,
  motionTranslationPxPerFrame,
  resolveVariantFromValue,
  resolveVariantMotion,
  TRANSITION_VARIANTS
} from "@transition/variantMotion";

describe("variantMotion", () => {
  it("maps every variant to a from source (single source of truth)", () => {
    expect(TRANSITION_VARIANTS).toHaveLength(10);
    expect(FROM_VARIANT["PUSHING-true"]).toBe("initial");
    expect(FROM_VARIANT["POPPING-false"]).toBe("PUSHING-false");
    expect(FROM_VARIANT["IDLE-true"]).toBe("self");
  });

  it("resolves initial-based and variant-based from values", () => {
    expect(resolveVariantFromValue(cupertino, "PUSHING-true")).toBe(cupertino.initial);
    expect(resolveVariantFromValue(cupertino, "POPPING-true")).toBe(
      cupertino.variants["IDLE-true"].value
    );
    expect(resolveVariantFromValue(cupertino, "IDLE-true")).toBeNull();
  });

  it("returns a full motion spec for an animated variant", () => {
    const motion = resolveVariantMotion(cupertino, "PUSHING-true")!;
    expect(motion.from).toBe(cupertino.initial);
    expect(motion.to).toBe(cupertino.variants["PUSHING-true"].value);
    expect(motion.duration).toBeCloseTo(0.6);
    expect(motion.delay).toBe(0);
    expect(motion.ease).toEqual([0.32, 0.72, 0, 1]);
  });

  it("returns null for rest variants and zero-duration variants", () => {
    expect(resolveVariantMotion(cupertino, "COMPLETED-true")).toBeNull();
    expect(resolveVariantMotion(cupertino, "IDLE-false")).toBeNull();
    // idle has duration 0.
    const idleLike = {
      initial: cupertino.initial,
      variants: {
        ...cupertino.variants,
        "PUSHING-true": { value: { x: 0 }, options: { duration: 0 } }
      }
    };
    expect(resolveVariantMotion(idleLike as never, "PUSHING-true")).toBeNull();
  });
});

describe("motionTranslationPxPerFrame", () => {
  const base = { width: 390, height: 720 };
  const motion = (from: object, to: object, duration: number) => ({
    from: from as never,
    to: to as never,
    duration,
    delay: 0,
    ease: undefined
  });

  it("resolves % against the axis base and averages over 60Hz frames", () => {
    // 100% of 390px over 0.6s (36 frames) ≈ 10.8 px/frame.
    expect(motionTranslationPxPerFrame(motion({ x: "100%" }, { x: 0 }, 0.6), base)).toBeCloseTo(
      390 / 36,
      5
    );
    // 1% of 390px over 0.15s (9 frames) ≈ 0.43 px/frame.
    expect(motionTranslationPxPerFrame(motion({ x: "1%" }, { x: 0 }, 0.15), base)).toBeCloseTo(
      3.9 / 9,
      5
    );
  });

  it("takes the dominant axis and handles px numbers and strings", () => {
    expect(
      motionTranslationPxPerFrame(motion({ x: 30, y: "720px" }, { x: 0, y: 0 }, 1), base)
    ).toBeCloseTo(12, 5);
  });

  it("treats non-translation values as no displacement", () => {
    expect(
      motionTranslationPxPerFrame(
        motion({ opacity: 0, x: "calc(1px + 2%)" }, { opacity: 1 }, 0.2),
        base
      )
    ).toBe(0);
    expect(motionTranslationPxPerFrame(motion("dark" as never, "light" as never, 0.2), base)).toBe(
      0
    );
  });

  it("clamps zero-duration motion to one frame", () => {
    expect(motionTranslationPxPerFrame(motion({ x: 10 }, { x: 0 }, 0), base)).toBe(10);
  });
});
