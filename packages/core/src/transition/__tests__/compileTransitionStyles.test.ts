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

import createDecorator from "@transition/decorator/createDecorator";
import overlay from "@transition/decorator/overlay";

declare module "@transition/typing" {
  interface RegisterTransition {
    "custom-fade-blur": "custom-fade-blur";
    "custom-slide-fade": "custom-slide-fade";
    "custom-rich-css": "custom-rich-css";
    "custom-unitless": "custom-unitless";
    "custom-lengths": "custom-lengths";
    "custom-css-vars": "custom-css-vars";
  }
}

declare module "@transition/decorator/typing" {
  interface RegisterDecorator {
    "rich-deco": "rich-deco";
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

    // The visible decorator animation rides on the screen that's moving INTO
    // the background — `PUSHING-false`, not `PUSHING-true`. The entering
    // screen's decorator sits at `idle` and emits only a rest rule.
    expect(css).toContain(
      '[data-flemo-decorator][data-flemo-decorator-name="overlay"][data-flemo-status="PUSHING"][data-flemo-active="false"]'
    );
    expect(css).toContain(`@keyframes ${animationName("decorator", "overlay", "PUSHING-false")}`);
  });

  it("emits camelCase CSS props as kebab-case", () => {
    const css = compileTransitionStyles([], [overlay]);

    expect(css).toContain("background-color: rgba(0, 0, 0, 0.3)");
    expect(css).not.toContain("backgroundColor");
  });

  // Decorators must accept the same CSS surface transitions do — author-defined
  // `filter`, `backdropFilter`, `boxShadow`, transform shortcuts, and CSS
  // custom properties all need to land in the keyframe and the `will-change`
  // hint so a decorator can drive arbitrary effects, not just opacity. We
  // probe PUSHING-false because that's the variant where `createDecorator`
  // animates idle → enter (the screen moving into the background), so every
  // rich property on `enter` shows up in the compiled keyframe.
  it("compiles arbitrary CSS properties on decorators (filter, boxShadow, transform shortcuts, custom property)", () => {
    const rich = createDecorator({
      name: "rich-deco",
      initial: {
        opacity: 0,
        filter: "blur(0px)",
        backdropFilter: "saturate(1)",
        boxShadow: "0 0 0 rgba(0,0,0,0)",
        "--brand": 0
      },
      idle: {
        value: {
          opacity: 0,
          filter: "blur(0px)",
          backdropFilter: "saturate(1)",
          boxShadow: "0 0 0 rgba(0,0,0,0)",
          "--brand": 0
        },
        options: { duration: 0 }
      },
      enter: {
        value: {
          opacity: 1,
          filter: "blur(8px)",
          backdropFilter: "saturate(1.6)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          "--brand": 1,
          x: -10,
          scale: 0.98,
          rotate: 2
        },
        options: { duration: 0.4 }
      },
      exit: {
        value: {
          opacity: 0,
          filter: "blur(0px)",
          backdropFilter: "saturate(1)",
          boxShadow: "0 0 0 rgba(0,0,0,0)",
          "--brand": 0
        },
        options: { duration: 0.4 }
      }
    });

    const css = compileTransitionStyles([], [rich]);
    const keyframe = css
      .split("\n\n")
      .find(
        (block) =>
          block.includes(animationName("decorator", "rich-deco", "PUSHING-false")) &&
          block.startsWith("@keyframes")
      );

    expect(keyframe).toBeDefined();
    // String CSS values pass through verbatim.
    expect(keyframe).toContain("filter: blur(0px)");
    expect(keyframe).toContain("filter: blur(8px)");
    // camelCase → kebab-case for arbitrary properties.
    expect(keyframe).toContain("backdrop-filter: saturate(1)");
    expect(keyframe).toContain("backdrop-filter: saturate(1.6)");
    expect(keyframe).toContain("box-shadow: 0 0 0 rgba(0,0,0,0)");
    expect(keyframe).toContain("box-shadow: 0 8px 24px rgba(0,0,0,0.25)");
    // CSS custom properties: no `px` suffix on numeric scalars.
    expect(keyframe).toContain("--brand: 0");
    expect(keyframe).toContain("--brand: 1");
    expect(keyframe).not.toContain("--brand: 0px");
    expect(keyframe).not.toContain("--brand: 1px");
    // Transform shortcuts collapse into a single `transform` decl on `to`.
    expect(keyframe).toContain("transform: translateX(-10px) scale(0.98) rotate(2deg)");

    // will-change lists exactly the properties the decorator writes. The
    // compiler emits the keyframe block + the selector rule joined by a single
    // newline (one entry in the `\n\n`-split list), so we assert against the
    // same block.
    expect(keyframe).toContain(
      '[data-flemo-decorator][data-flemo-decorator-name="rich-deco"][data-flemo-status="PUSHING"][data-flemo-active="false"]'
    );
    expect(keyframe).toContain("will-change:");
    expect(keyframe).toContain("opacity");
    expect(keyframe).toContain("filter");
    expect(keyframe).toContain("backdrop-filter");
    expect(keyframe).toContain("box-shadow");
    expect(keyframe).toContain("--brand");
    expect(keyframe).toContain("transform");
  });

  it("passes string values through verbatim for arbitrary CSS properties (filter, boxShadow, color)", () => {
    const custom = createTransition({
      name: "custom-rich-css",
      initial: { filter: "blur(8px)", color: "rgb(0,0,0)" },
      idle: { value: { filter: "blur(0px)", color: "rgb(255,255,255)" }, options: { duration: 0 } },
      enter: {
        value: {
          filter: "blur(0px)",
          color: "rgb(255,255,255)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
        },
        options: { duration: 0.3 }
      },
      enterBack: {
        value: { filter: "blur(8px)", color: "rgb(0,0,0)" },
        options: { duration: 0.3 }
      },
      exit: { value: { filter: "blur(8px)", color: "rgb(0,0,0)" }, options: { duration: 0.3 } },
      exitBack: {
        value: { filter: "blur(0px)", color: "rgb(255,255,255)" },
        options: { duration: 0.3 }
      }
    });

    const css = compileTransitionStyles([custom], []);
    expect(css).toContain("filter: blur(0px)");
    expect(css).toContain("filter: blur(8px)");
    expect(css).toContain("color: rgb(255,255,255)");
    expect(css).toContain("box-shadow: 0 4px 12px rgba(0,0,0,0.2)");
  });

  it("does NOT append `px` to unitless CSS properties (lineHeight, fontWeight, zIndex, flexGrow)", () => {
    const custom = createTransition({
      name: "custom-unitless",
      initial: { lineHeight: 1, fontWeight: 400, zIndex: 0, flexGrow: 0 },
      idle: {
        value: { lineHeight: 1.5, fontWeight: 600, zIndex: 10, flexGrow: 1 },
        options: { duration: 0 }
      },
      enter: {
        value: { lineHeight: 1.5, fontWeight: 600, zIndex: 10, flexGrow: 1 },
        options: { duration: 0.3 }
      },
      enterBack: {
        value: { lineHeight: 1, fontWeight: 400, zIndex: 0, flexGrow: 0 },
        options: { duration: 0.3 }
      },
      exit: {
        value: { lineHeight: 1, fontWeight: 400, zIndex: 0, flexGrow: 0 },
        options: { duration: 0.3 }
      },
      exitBack: {
        value: { lineHeight: 1.5, fontWeight: 600, zIndex: 10, flexGrow: 1 },
        options: { duration: 0.3 }
      }
    });

    const css = compileTransitionStyles([custom], []);
    // Sanity: each numeric-unitless property emits no `px` suffix
    expect(css).toMatch(/line-height: 1\.5;/);
    expect(css).toMatch(/font-weight: 600;/);
    expect(css).toMatch(/z-index: 10;/);
    expect(css).toMatch(/flex-grow: 1;/);
    expect(css).not.toMatch(/line-height: 1\.5px/);
    expect(css).not.toMatch(/font-weight: 600px/);
    expect(css).not.toMatch(/z-index: 10px/);
    expect(css).not.toMatch(/flex-grow: 1px/);
  });

  it("does NOT append `px` to CSS custom property values (typeless `--foo`)", () => {
    const custom = createTransition({
      name: "custom-css-vars",
      initial: { "--space": 0, "--ratio": 1 },
      idle: { value: { "--space": 16, "--ratio": 1.5 }, options: { duration: 0 } },
      enter: { value: { "--space": 16, "--ratio": 1.5 }, options: { duration: 0.3 } },
      enterBack: { value: { "--space": 0, "--ratio": 1 }, options: { duration: 0.3 } },
      exit: { value: { "--space": 0, "--ratio": 1 }, options: { duration: 0.3 } },
      exitBack: { value: { "--space": 16, "--ratio": 1.5 }, options: { duration: 0.3 } }
    });

    const css = compileTransitionStyles([custom], []);
    expect(css).toMatch(/--space: 16;/);
    expect(css).toMatch(/--ratio: 1\.5;/);
    expect(css).not.toMatch(/--space: 16px/);
    expect(css).not.toMatch(/--ratio: 1\.5px/);
  });

  it("still appends `px` to length-like number values (width, top, margin)", () => {
    const custom = createTransition({
      name: "custom-lengths",
      initial: { width: 0, top: 0, marginLeft: 0 },
      idle: { value: { width: 100, top: 50, marginLeft: 8 }, options: { duration: 0 } },
      enter: { value: { width: 100, top: 50, marginLeft: 8 }, options: { duration: 0.3 } },
      enterBack: { value: { width: 0, top: 0, marginLeft: 0 }, options: { duration: 0.3 } },
      exit: { value: { width: 0, top: 0, marginLeft: 0 }, options: { duration: 0.3 } },
      exitBack: { value: { width: 100, top: 50, marginLeft: 8 }, options: { duration: 0.3 } }
    });

    const css = compileTransitionStyles([custom], []);
    expect(css).toContain("width: 100px");
    expect(css).toContain("top: 50px");
    expect(css).toContain("margin-left: 8px");
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
  // that contains `selectorSubstring`. Returns the text from the rule's first
  // selector line through the matching closing brace. Handles multi-line
  // selectors (comma-separated screen + riding-bar pairs).
  const findRule = (css: string, selectorSubstring: string): string | undefined => {
    const lines = css.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.startsWith("@keyframes")) continue;
      if (!line.includes(selectorSubstring)) continue;
      // Walk back over preceding lines that end with `,` — they're part of
      // this same multi-line selector list.
      let startIdx = i;
      while (startIdx > 0 && lines[startIdx - 1]!.trimEnd().endsWith(",")) {
        startIdx -= 1;
      }
      const collected: string[] = [];
      for (let j = startIdx; j < lines.length; j++) {
        collected.push(lines[j]!);
        if (lines[j]!.trim() === "}") return collected.join("\n");
      }
      return collected.join("\n");
    }
    return undefined;
  };

  // Enumerate every non-@keyframes rule block. Tracks brace depth so an
  // @keyframes block's inner `from`/`to` curlies don't get mistaken for a
  // top-level rule boundary.
  const findAllRules = (css: string): string[] => {
    const lines = css.split("\n");
    const blocks: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i]!;
      if (line.startsWith("@keyframes")) {
        let depth = 0;
        let braceSeen = false;
        while (i < lines.length) {
          for (const ch of lines[i]!) {
            if (ch === "{") {
              depth += 1;
              braceSeen = true;
            } else if (ch === "}") {
              depth -= 1;
            }
          }
          i += 1;
          if (braceSeen && depth === 0) break;
        }
        continue;
      }
      if (!line.includes("[data-flemo-")) {
        i += 1;
        continue;
      }
      const collected: string[] = [];
      let j = i;
      while (j < lines.length) {
        collected.push(lines[j]!);
        if (lines[j]!.trim() === "}") break;
        j += 1;
      }
      blocks.push(collected.join("\n"));
      i = j + 1;
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
    // The animating decorator slot is the screen going behind, not the active
    // side — that's where `idle → enter` actually runs and the layer needs
    // promoting.
    const pushInactive = findRule(
      css,
      '[data-flemo-decorator][data-flemo-decorator-name="overlay"][data-flemo-status="PUSHING"][data-flemo-active="false"]'
    );

    expect(pushInactive).toBeDefined();
    expect(pushInactive).toMatch(/will-change:/);
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
