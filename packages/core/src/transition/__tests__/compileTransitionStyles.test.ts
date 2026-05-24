import { describe, expect, it } from "vitest";

import {
  animationName,
  collectAnimatedProperties,
  compileTransitionStyles,
  variantHasAnimation
} from "@transition/compileTransitionStyles";
import createTransition from "@transition/createTransition";
import cupertino from "@transition/cupertino";

import layout from "@transition/layout";
import material from "@transition/material";
import none from "@transition/none";

import overlay from "@transition/decorator/overlay";

declare module "@transition/typing" {
  interface RegisterTransition {
    "custom-fade-blur": "custom-fade-blur";
    "custom-slide-fade": "custom-slide-fade";
  }
}

describe("compileTransitionStyles", () => {
  it("emits a keyframe + rule for the active push entrance", () => {
    const css = compileTransitionStyles([cupertino], []);

    expect(css).toContain(`@keyframes ${animationName("screen", "cupertino", "PUSHING-true")}`);
    expect(css).toContain("transform: translateX(100%)");
    // Identity target collapses to `transform: none` so the resting scope
    // doesn't create a containing block / stacking context.
    expect(css).toContain("transform: none");
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
    // returning screen comes from the exit position (x: -100px) back to identity
    expect(popInactive).toContain("transform: translateX(-100px)");
    expect(popInactive).toContain("transform: none");
  });

  it("emits `transform: none` (not an identity matrix) in rest rules so the scope creates no stacking context", () => {
    const css = compileTransitionStyles([cupertino], []);

    // cupertino's IDLE-true / COMPLETED-true targets are { x: 0 } — identity.
    // The rest rule still exists (other props may be present), but the
    // transform decl collapses to `none`, which per CSS spec creates no
    // containing block or stacking context. Consumer overlays' fixed
    // positioning and z-index inside the scope remain free.
    const idleActive = css
      .split("\n\n")
      .find((block) =>
        block.startsWith(
          '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="IDLE"][data-flemo-active="true"]'
        )
      );

    expect(idleActive).toBeDefined();
    expect(idleActive).not.toContain("@keyframes");
    expect(idleActive).toContain("transform: none");
    expect(idleActive).not.toContain("translateX(0px)");
  });

  it("collapses identity-only transform targets to `transform: none`", () => {
    const css = compileTransitionStyles([cupertino], []);

    // PUSHING-true keyframe's `to` block reaches identity ({ x: 0 }).
    const pushActive = css
      .split("\n\n")
      .find(
        (block) =>
          block.includes(animationName("screen", "cupertino", "PUSHING-true")) &&
          block.startsWith("@keyframes")
      );

    expect(pushActive).toBeDefined();
    expect(pushActive).toContain("transform: none");
    expect(pushActive).not.toContain("translateX(0px)");
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
    // material's enter/exitBack/idle targets are y: 0 (identity) → collapses
    // to `transform: none` so the resting scope stays free of stacking-context.
    expect(css).toContain("transform: none");
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

describe("collectAnimatedProperties", () => {
  it("collapses transform-bucket props to a single `transform` entry", () => {
    expect(collectAnimatedProperties(cupertino)).toEqual(["transform"]);
    expect(collectAnimatedProperties(material)).toEqual(["transform"]);
  });

  it("returns non-transform props in kebab-case", () => {
    expect(collectAnimatedProperties(layout)).toEqual(["opacity"]);
  });

  it("returns an empty list for the `none` transition", () => {
    expect(collectAnimatedProperties(none)).toEqual([]);
  });

  it("collects custom author-defined props (filter, color, etc.)", () => {
    const custom = createTransition({
      name: "custom-fade-blur",
      initial: { opacity: 0, filter: "blur(8px)" },
      idle: { value: { opacity: 1, filter: "blur(0px)" }, options: { duration: 0 } },
      enter: { value: { opacity: 1, filter: "blur(0px)" }, options: { duration: 0.3 } },
      enterBack: { value: { opacity: 0, filter: "blur(8px)" }, options: { duration: 0.3 } },
      exit: { value: { opacity: 0, filter: "blur(8px)" }, options: { duration: 0.3 } },
      exitBack: { value: { opacity: 1, filter: "blur(0px)" }, options: { duration: 0.3 } }
    });

    expect(collectAnimatedProperties(custom).sort()).toEqual(["filter", "opacity"]);
  });

  it("combines transform with non-transform props when both appear", () => {
    const custom = createTransition({
      name: "custom-slide-fade",
      initial: { x: "100%", opacity: 0 },
      idle: { value: { x: 0, opacity: 1 }, options: { duration: 0 } },
      enter: { value: { x: 0, opacity: 1 }, options: { duration: 0.3 } },
      enterBack: { value: { x: "100%", opacity: 0 }, options: { duration: 0.3 } },
      exit: { value: { x: -100, opacity: 0 }, options: { duration: 0.3 } },
      exitBack: { value: { x: 0, opacity: 1 }, options: { duration: 0.3 } }
    });

    expect(collectAnimatedProperties(custom).sort()).toEqual(["opacity", "transform"]);
  });
});

describe("compileTransitionStyles — will-change (compositor promotion)", () => {
  // The 60fps story is: every variant that actually animates carries a
  // `will-change` listing exactly what it writes, scoped to the same status
  // selector as the animation. The browser promotes a compositor layer the
  // moment the status attribute flips to PUSHING/POPPING/REPLACING, drops it
  // when status flips back to IDLE/COMPLETED, and never holds it on rest /
  // zero-duration / "self" variants. These tests pin that contract.

  // Locate the standalone rule block (not the `@keyframes ... { ... }` block)
  // whose opening line contains `selectorSubstring`. Returns the text from the
  // opening selector through the matching closing brace.
  const findRule = (css: string, selectorSubstring: string): string | undefined => {
    const lines = css.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.startsWith("@keyframes")) continue;
      if (!line.includes(selectorSubstring)) continue;
      if (!line.trimEnd().endsWith("{")) continue;
      const collected: string[] = [];
      for (let j = i; j < lines.length; j++) {
        collected.push(lines[j]!);
        if (lines[j]!.trim() === "}") return collected.join("\n");
      }
      return collected.join("\n");
    }
    return undefined;
  };

  const findAllRules = (css: string): string[] => {
    const lines = css.split("\n");
    const blocks: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.startsWith("@keyframes")) continue;
      if (!line.trimEnd().endsWith("{")) continue;
      if (!line.includes("[data-flemo-")) continue;
      const collected: string[] = [];
      for (let j = i; j < lines.length; j++) {
        collected.push(lines[j]!);
        if (lines[j]!.trim() === "}") {
          blocks.push(collected.join("\n"));
          break;
        }
      }
    }
    return blocks;
  };

  it("emits will-change with the animated property on the active push entrance", () => {
    const css = compileTransitionStyles([cupertino], []);
    const pushActive = findRule(css, '[data-flemo-status="PUSHING"][data-flemo-active="true"]');

    expect(pushActive).toBeDefined();
    expect(pushActive).toContain("animation:");
    expect(pushActive).toMatch(/will-change:\s*transform;/);
  });

  it("emits will-change with multiple properties when the transition writes more than one", () => {
    const css = compileTransitionStyles([layout], []);
    const pushActive = findRule(
      css,
      '[data-flemo-transition="layout"][data-flemo-status="PUSHING"]'
    );

    expect(pushActive).toBeDefined();
    expect(pushActive).toMatch(/will-change:\s*opacity;/);
  });

  it("lists exactly the properties the variant writes (transform + opacity together)", () => {
    const slideFade = createTransition({
      name: "custom-slide-fade",
      initial: { x: "100%", opacity: 0 },
      idle: { value: { x: 0, opacity: 1 }, options: { duration: 0 } },
      enter: { value: { x: 0, opacity: 1 }, options: { duration: 0.3 } },
      enterBack: { value: { x: "100%", opacity: 0 }, options: { duration: 0.3 } },
      exit: { value: { x: -100, opacity: 0 }, options: { duration: 0.3 } },
      exitBack: { value: { x: 0, opacity: 1 }, options: { duration: 0.3 } }
    });

    const css = compileTransitionStyles([slideFade], []);
    const pushActive = findRule(
      css,
      '[data-flemo-transition="custom-slide-fade"][data-flemo-status="PUSHING"]'
    );

    expect(pushActive).toBeDefined();
    const match = pushActive!.match(/will-change:\s*([^;]+);/);
    expect(match).not.toBeNull();
    const properties = match![1]!.split(",").map((s) => s.trim());
    expect(properties.sort()).toEqual(["opacity", "transform"]);
  });

  it("respects author-defined non-transform / non-opacity properties (filter, etc.)", () => {
    const blur = createTransition({
      name: "custom-fade-blur",
      initial: { opacity: 0, filter: "blur(8px)" },
      idle: { value: { opacity: 1, filter: "blur(0px)" }, options: { duration: 0 } },
      enter: { value: { opacity: 1, filter: "blur(0px)" }, options: { duration: 0.3 } },
      enterBack: { value: { opacity: 0, filter: "blur(8px)" }, options: { duration: 0.3 } },
      exit: { value: { opacity: 0, filter: "blur(8px)" }, options: { duration: 0.3 } },
      exitBack: { value: { opacity: 1, filter: "blur(0px)" }, options: { duration: 0.3 } }
    });

    const css = compileTransitionStyles([blur], []);
    const pushActive = findRule(
      css,
      '[data-flemo-transition="custom-fade-blur"][data-flemo-status="PUSHING"]'
    );

    expect(pushActive).toBeDefined();
    const match = pushActive!.match(/will-change:\s*([^;]+);/);
    expect(match).not.toBeNull();
    const properties = match![1]!.split(",").map((s) => s.trim());
    expect(properties.sort()).toEqual(["filter", "opacity"]);
  });

  it("does NOT emit will-change on rest rules (IDLE / COMPLETED 'self' variants)", () => {
    const css = compileTransitionStyles([cupertino], []);
    const restBlocks = findAllRules(css).filter(
      (block) =>
        block.includes('[data-flemo-status="IDLE"]') ||
        block.includes('[data-flemo-status="COMPLETED"]')
    );

    expect(restBlocks.length).toBeGreaterThan(0);
    for (const block of restBlocks) {
      expect(block).not.toContain("will-change");
    }
  });

  it("does NOT emit will-change for the empty 'none' transition", () => {
    const css = compileTransitionStyles([none], []);
    expect(css).not.toContain("will-change");
  });

  it("scopes will-change to the same status selector as the animation (auto-cleared on status change)", () => {
    const css = compileTransitionStyles([cupertino], []);
    // Every will-change should live inside a rule whose selector already
    // carries a transitioning status (PUSHING / POPPING / REPLACING). Once
    // ScreenMotion flips the attribute to COMPLETED, the rule stops matching
    // and the hint is released without any JS cleanup.
    const rulesWithWillChange = findAllRules(css).filter((block) => block.includes("will-change"));
    expect(rulesWithWillChange.length).toBeGreaterThan(0);
    for (const block of rulesWithWillChange) {
      const selectorLine = block.split("{")[0]!;
      expect(selectorLine).toMatch(/data-flemo-status="(PUSHING|POPPING|REPLACING)"/);
    }
  });

  it("emits will-change on decorator variant rules too", () => {
    const css = compileTransitionStyles([], [overlay]);
    const pushActive = findRule(
      css,
      '[data-flemo-decorator][data-flemo-decorator-name="overlay"][data-flemo-status="PUSHING"][data-flemo-active="true"]'
    );

    expect(pushActive).toBeDefined();
    expect(pushActive).toMatch(/will-change:/);
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
