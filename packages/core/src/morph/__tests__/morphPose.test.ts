import { describe, expect, it } from "vitest";

import {
  composePosesToCss,
  IDENTITY_POSE,
  interpolatePose,
  poseIsIdentity,
  poseToCss,
  resolveLength,
  resolvePose
} from "@morph/morphPose";

const SCREEN = { width: 400, height: 800 };

describe("resolveLength", () => {
  it("resolves percentages against the box they belong to", () => {
    expect(resolveLength("100%", 400)).toBe(400);
    expect(resolveLength("-30%", 400)).toBe(-120);
  });

  it("passes px and unitless numbers through", () => {
    expect(resolveLength(16, 400)).toBe(16);
    expect(resolveLength("16px", 400)).toBe(16);
    expect(resolveLength("16", 400)).toBe(16);
    expect(resolveLength(undefined, 400)).toBe(0);
  });

  it("refuses units it cannot turn into a number", () => {
    // The alternative is a guess, and a guessed length puts a shared element
    // somewhere it never was. A null degrades the counter-ride instead.
    expect(resolveLength("2rem", 400)).toBeNull();
    expect(resolveLength("calc(100% - 8px)", 400)).toBeNull();
    expect(resolveLength("10vh", 400)).toBeNull();
  });
});

describe("resolvePose", () => {
  it("reads a transition's transform channels", () => {
    expect(resolvePose({ x: "100%", scale: 0.9 }, SCREEN)).toEqual({
      x: 400,
      y: 0,
      scaleX: 0.9,
      scaleY: 0.9,
      rotate: 0
    });
  });

  it("lets per-axis scale override the uniform one", () => {
    expect(resolvePose({ scale: 2, scaleY: 3 }, SCREEN)).toMatchObject({ scaleX: 2, scaleY: 3 });
  });

  it("returns the identity for a target with no transform", () => {
    expect(resolvePose({ opacity: 0.5 }, SCREEN)).toEqual(IDENTITY_POSE);
    expect(resolvePose(null, SCREEN)).toEqual(IDENTITY_POSE);
  });

  it("returns null when any channel is unresolvable", () => {
    expect(resolvePose({ x: "2rem" }, SCREEN)).toBeNull();
  });
});

describe("poseToCss", () => {
  it("emits translate3d, not translateX/Y", () => {
    // Same reason the keyframes compiler does: the 2D form gets pixel-snapped
    // on raster-heavy content and steps through the deceleration tail.
    expect(poseToCss({ x: 10, y: -4, scaleX: 1, scaleY: 1, rotate: 0 })).toBe(
      "translate3d(10px, -4px, 0)"
    );
  });

  it("collapses the identity to none", () => {
    expect(poseToCss(IDENTITY_POSE)).toBe("none");
    expect(poseIsIdentity(IDENTITY_POSE)).toBe(true);
  });

  it("composes several poses outermost-first, skipping identities", () => {
    const ride = { x: -400, y: 0, scaleX: 1, scaleY: 1, rotate: 0 };
    const travel = { x: 20, y: 30, scaleX: 0.5, scaleY: 0.5, rotate: 0 };
    expect(composePosesToCss([ride, travel, IDENTITY_POSE])).toBe(
      "translate3d(-400px, 0px, 0) translate3d(20px, 30px, 0) scale(0.5, 0.5)"
    );
  });
});

describe("interpolatePose", () => {
  it("walks every channel linearly", () => {
    expect(
      interpolatePose(
        { x: 0, y: 0, scaleX: 0.5, scaleY: 2, rotate: 0 },
        { x: 100, y: -50, scaleX: 1, scaleY: 1, rotate: 90 },
        0.5
      )
    ).toEqual({ x: 50, y: -25, scaleX: 0.75, scaleY: 1.5, rotate: 45 });
  });
});
