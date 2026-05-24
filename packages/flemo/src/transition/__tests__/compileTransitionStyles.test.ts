import { describe, expect, it } from "vitest";

import {
  animationName,
  compileTransitionStyles,
  variantHasAnimation
} from "@transition/compileTransitionStyles";
import cupertino from "@transition/cupertino";

import layout from "@transition/layout";
import material from "@transition/material";
import none from "@transition/none";

import overlay from "@transition/decorator/overlay";

describe("compileTransitionStyles", () => {
  it("emits a keyframe + rule for the active push entrance", () => {
    const css = compileTransitionStyles([cupertino], []);

    expect(css).toContain(`@keyframes ${animationName("screen", "cupertino", "PUSHING-true")}`);
    expect(css).toContain("transform: translateX(100%)");
    expect(css).toContain("transform: translateX(0px)");
    expect(css).toContain(
      '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="PUSHING"][data-flemo-active="true"]'
    );
    expect(css).toContain("cubic-bezier(0.32, 0.72, 0, 1)");
    expect(css).toContain("0.7s");
  });

  it("uses the previous-exit position as the from-state for POPPING-false", () => {
    const css = compileTransitionStyles([cupertino], []);

    const popInactive = css
      .split("\n\n")
      .find(
        (block) =>
          block.includes(animationName("screen", "cupertino", "POPPING-false")) &&
          block.startsWith("@keyframes")
      );

    expect(popInactive).toBeDefined();
    // returning screen comes from the exit position (x: -100px) back to x: 0
    expect(popInactive).toContain("transform: translateX(-100px)");
    expect(popInactive).toContain("transform: translateX(0px)");
  });

  it("emits rest rules (no animation) for IDLE and COMPLETED states", () => {
    const css = compileTransitionStyles([cupertino], []);

    const idleActive = css
      .split("\n\n")
      .find((block) =>
        block.startsWith(
          '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="IDLE"][data-flemo-active="true"]'
        )
      );

    expect(idleActive).toBeDefined();
    expect(idleActive).not.toContain("@keyframes");
    expect(idleActive).toContain("transform: translateX(0px)");
  });

  it("emits no rules at all for the 'none' transition (empty value)", () => {
    const css = compileTransitionStyles([none], []);

    expect(css).not.toContain("@keyframes");
    expect(css).not.toContain('data-flemo-transition="none"');
  });

  it("animates opacity for the layout transition", () => {
    const css = compileTransitionStyles([layout], []);

    expect(css).toContain(`@keyframes ${animationName("screen", "layout", "PUSHING-true")}`);
    expect(css).toContain("opacity: 0.97");
    expect(css).toContain("opacity: 1");
  });

  it("animates translateY for material", () => {
    const css = compileTransitionStyles([material], []);

    expect(css).toContain("transform: translateY(100%)");
    expect(css).toContain("transform: translateY(0px)");
    expect(css).toContain("0.35s");
  });

  it("compiles decorator rules under the decorator selector", () => {
    const css = compileTransitionStyles([], [overlay]);

    expect(css).toContain(
      '[data-flemo-decorator][data-flemo-decorator-name="overlay"][data-flemo-status="PUSHING"][data-flemo-active="true"]'
    );
    // The keyframe's `to` is the variant value (opacity: 0, background... etc.).
    expect(css).toContain(`@keyframes ${animationName("decorator", "overlay", "PUSHING-true")}`);
  });

  it("emits camelCase CSS props as kebab-case", () => {
    const css = compileTransitionStyles([], [overlay]);

    expect(css).toContain("background-color: rgba(0, 0, 0, 0.3)");
    expect(css).not.toContain("backgroundColor");
  });
});

describe("variantHasAnimation", () => {
  it("returns true for transitioning variants with non-zero duration", () => {
    expect(variantHasAnimation(cupertino, "PUSHING-true")).toBe(true);
    expect(variantHasAnimation(cupertino, "POPPING-false")).toBe(true);
  });

  it("returns false for rest variants", () => {
    expect(variantHasAnimation(cupertino, "IDLE-true")).toBe(false);
    expect(variantHasAnimation(cupertino, "COMPLETED-true")).toBe(false);
  });

  it("returns false for the none transition (zero duration, empty value)", () => {
    expect(variantHasAnimation(none, "PUSHING-true")).toBe(false);
    expect(variantHasAnimation(none, "POPPING-false")).toBe(false);
  });
});
