import { describe, expect, it } from "vitest";

import cupertino from "@transition/cupertino";
import {
  FROM_VARIANT,
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
