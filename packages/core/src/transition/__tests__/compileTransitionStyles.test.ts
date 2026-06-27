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

import createBarTransition from "@transition/barTransition/createBarTransition";

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
    // returning screen comes from the exit position (x: -30%) back to identity
    expect(popInactive).toContain("transform: translateX(-30%)");
    expect(popInactive).toContain("transform: none");
  });

  it("fades the material outgoing screen out as it slides up (PUSHING-false)", () => {
    const css = compileTransitionStyles([material], []);

    const pushInactive = css
      .split("\n\n")
      .find(
        (block) =>
          block.includes(animationName("screen", "material", "PUSHING-false")) &&
          block.startsWith("@keyframes")
      );

    expect(pushInactive).toBeDefined();
    // outgoing screen lifts to -56px while fading from opaque to transparent
    expect(pushInactive).toContain("opacity: 1");
    expect(pushInactive).toContain("opacity: 0");
    expect(pushInactive).toContain("transform: translateY(-56px)");
  });

  it("emits `transform: none` (not an identity matrix) in rest rules so the scope creates no stacking context", () => {
    const css = compileTransitionStyles([cupertino], []);

    // cupertino's IDLE-true / COMPLETED-true targets are { x: 0 }: identity.
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
    // the background: `PUSHING-false`, not `PUSHING-true`. The entering
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

  // Decorators must accept the same CSS surface transitions do: author-defined
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
    // material animates y (transform bucket) plus opacity for the exit fade.
    // The y collapses into one `transform` entry, opacity is tracked alongside.
    expect(collectAnimatedProperties(material)).toEqual(["opacity", "transform"]);
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

describe("compileTransitionStyles: will-change (compositor promotion)", () => {
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
      // Walk back over preceding lines that end with `,`. They're part of
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
    // side. That's where `idle → enter` actually runs and the layer needs
    // promoting.
    const pushInactive = findRule(
      css,
      '[data-flemo-decorator][data-flemo-decorator-name="overlay"][data-flemo-status="PUSHING"][data-flemo-active="false"]'
    );

    expect(pushInactive).toBeDefined();
    expect(pushInactive).toMatch(/will-change:/);
  });
});

describe("compileTransitionStyles: shared-bar ride-along selector", () => {
  // The compositor-sync story (commit 9e0384c): every animating screen rule
  // also targets a `[data-flemo-bar][data-flemo-bar-riding="true"]` sibling
  // under the SAME `animation:` + `will-change:` declarations. A bar wrapper
  // toggled to `riding=true` then runs the screen's @keyframes on the same
  // compositor pass, so there's no rAF JS mirror in the loop. These tests pin
  // that contract. If it ever regresses, mobile bars start trailing the
  // screen by one composited frame.

  // Re-use the helpers from the will-change describe block. They're scoped
  // there, so duplicate them here rather than refactoring shared state.
  const findRule = (css: string, selectorSubstring: string): string | undefined => {
    const lines = css.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.startsWith("@keyframes")) continue;
      if (!line.includes(selectorSubstring)) continue;
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

  it("pairs the screen rule with a riding-bar sibling under one animation + will-change block", () => {
    const css = compileTransitionStyles([cupertino], []);
    const pushActive = findRule(
      css,
      '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="PUSHING"][data-flemo-active="true"]'
    );

    expect(pushActive).toBeDefined();
    // Same block must include the bar sibling: only one `animation:` and one
    // `will-change:` for the pair, so the screen and bar run the exact same
    // @keyframes on the same compositor pass.
    expect(pushActive).toContain(
      '[data-flemo-bar][data-flemo-bar-transition="cupertino"][data-flemo-bar-status="PUSHING"][data-flemo-bar-active="true"][data-flemo-bar-riding="true"]'
    );
    expect((pushActive!.match(/animation:/g) ?? []).length).toBe(1);
    expect((pushActive!.match(/will-change:/g) ?? []).length).toBe(1);
  });

  it("mirrors screen status/active onto the bar selector for every transitioning variant", () => {
    const css = compileTransitionStyles([cupertino], []);
    const variants: Array<[string, string]> = [
      ["PUSHING", "true"],
      ["PUSHING", "false"],
      ["POPPING", "true"],
      ["POPPING", "false"],
      ["REPLACING", "true"],
      ["REPLACING", "false"]
    ];
    for (const [status, active] of variants) {
      const block = findRule(
        css,
        `[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="${status}"][data-flemo-active="${active}"]`
      );
      // Cupertino doesn't animate every variant (some hold rest), so skip
      // the ones with no animation rule.
      if (!block || !block.includes("animation:")) continue;
      expect(block).toContain(
        `[data-flemo-bar][data-flemo-bar-transition="cupertino"][data-flemo-bar-status="${status}"][data-flemo-bar-active="${active}"][data-flemo-bar-riding="true"]`
      );
    }
  });

  it("does NOT pair a bar sibling onto decorator rules (decorators stay screen-only)", () => {
    const css = compileTransitionStyles([], [overlay]);
    const decoBlock = findRule(
      css,
      '[data-flemo-decorator][data-flemo-decorator-name="overlay"][data-flemo-status="PUSHING"][data-flemo-active="false"]'
    );

    expect(decoBlock).toBeDefined();
    expect(decoBlock).toContain("animation:");
    expect(decoBlock).not.toContain("data-flemo-bar");
  });

  it("does NOT emit a bar selector for the empty 'none' transition", () => {
    const css = compileTransitionStyles([none], []);
    expect(css).not.toContain("data-flemo-bar");
  });

  it("does NOT pair a bar sibling onto rest rules (IDLE / COMPLETED: no animation, no compositor sync needed)", () => {
    const css = compileTransitionStyles([cupertino], []);
    const idleActive = findRule(
      css,
      '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="IDLE"][data-flemo-active="true"]'
    );

    expect(idleActive).toBeDefined();
    expect(idleActive).not.toContain("animation:");
    expect(idleActive).not.toContain("data-flemo-bar");
  });

  it("emits `contain: layout` and `pointer-events: none` on PUSHING / REPLACING rules (where new screens mount)", () => {
    // The hints isolate the transitioning scope from heavy work happening
    // inside the arriving screen during its initial mount commit. They're
    // scoped to PUSHING and REPLACING, the verbs that actually trigger a
    // mount. Pop is intentionally excluded (see below).
    const cssCupertino = compileTransitionStyles([cupertino], []);
    const pushActive = findRule(
      cssCupertino,
      '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="PUSHING"][data-flemo-active="true"]'
    );
    expect(pushActive).toBeDefined();
    expect(pushActive).toMatch(/contain:\s*layout;/);
    expect(pushActive).toMatch(/pointer-events:\s*none;/);

    const replaceActive = findRule(
      cssCupertino,
      '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="REPLACING"][data-flemo-active="true"]'
    );
    if (replaceActive) {
      expect(replaceActive).toMatch(/contain:\s*layout;/);
      expect(replaceActive).toMatch(/pointer-events:\s*none;/);
    }

    // Bar sibling rides under the same block, so it inherits both.
    expect(pushActive).toContain("[data-flemo-bar]");

    // Decorator rules get them too: the overlay needs to be non-clickable
    // mid-transition and shouldn't propagate layout invalidation.
    const cssOverlay = compileTransitionStyles([], [overlay]);
    const decoRule = findRule(
      cssOverlay,
      '[data-flemo-decorator][data-flemo-decorator-name="overlay"][data-flemo-status="PUSHING"][data-flemo-active="false"]'
    );
    expect(decoRule).toBeDefined();
    expect(decoRule).toMatch(/contain:\s*layout;/);
    expect(decoRule).toMatch(/pointer-events:\s*none;/);
  });

  it("does NOT emit `contain` or `pointer-events` on POPPING rules (no mount work to isolate; avoids containment-block cost on heavy exiting screens)", () => {
    // ScreenFreeze keeps popped-from screens mounted via display:none, so
    // pop's destination has no fresh mount work and there's nothing for
    // containment to isolate. The e2e harness measured ~8ms regression on
    // 2k-DOM exiting screens during pop with the hints applied: pure cost
    // with no upside. POPPING-true (the exiting screen) and POPPING-false
    // (the returning screen) must both stay clean.
    const css = compileTransitionStyles([cupertino], []);
    const popActive = findRule(
      css,
      '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="POPPING"][data-flemo-active="true"]'
    );
    const popInactive = findRule(
      css,
      '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="POPPING"][data-flemo-active="false"]'
    );

    for (const block of [popActive, popInactive]) {
      if (!block) continue;
      expect(block).not.toMatch(/contain:/);
      expect(block).not.toMatch(/pointer-events:/);
    }
  });

  it("does NOT emit `contain` or `pointer-events` on rest rules (IDLE / COMPLETED restore interaction + layout)", () => {
    const css = compileTransitionStyles([cupertino], []);
    const idleActive = findRule(
      css,
      '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="IDLE"][data-flemo-active="true"]'
    );
    const completedActive = findRule(
      css,
      '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="COMPLETED"][data-flemo-active="true"]'
    );

    for (const block of [idleActive, completedActive]) {
      if (!block) continue;
      expect(block).not.toMatch(/contain:/);
      expect(block).not.toMatch(/pointer-events:/);
    }
  });

  it('requires data-flemo-bar-riding="true" on the bar selector (bars only ride when ScreenMotion opts them in)', () => {
    // Without the riding attribute the sibling selector wouldn't match, so a
    // partner-owned bar stays untouched. Pin the attribute literal in the
    // compiled output so a refactor can't silently drop it.
    const css = compileTransitionStyles([cupertino], []);
    const barLines = css.split("\n").filter((line) => line.includes("data-flemo-bar"));
    expect(barLines.length).toBeGreaterThan(0);
    for (const line of barLines) {
      expect(line).toContain('[data-flemo-bar-riding="true"]');
    }
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

declare module "@transition/barTransition/typing" {
  interface RegisterBarTransition {
    "test-title-fade": "test-title-fade";
  }
}

describe("compileTransitionStyles bar transitions", () => {
  const titleFade = createBarTransition({
    name: "test-title-fade",
    initial: { opacity: 0 },
    idle: { value: { opacity: 1 }, options: { duration: 0.4 } },
    enter: { value: { opacity: 0 }, options: { duration: 0.3 } },
    exit: { value: { opacity: 1 }, options: { duration: 0.3 } }
  });

  it("emits per-element selectors keyed by data-flemo-bar-transition-name + status + active", () => {
    const css = compileTransitionStyles([], [], [titleFade]);
    expect(css).toContain(
      '[data-flemo-bar-transition-name="test-title-fade"][data-flemo-status="PUSHING"][data-flemo-active="true"]'
    );
    // Never paired with the screen ride-along selector (that's screen scope only).
    expect(css).not.toContain("data-flemo-bar-riding");
  });

  it("emits a keyframe in the bar scope for the leaving side fading out", () => {
    const css = compileTransitionStyles([], [], [titleFade]);
    expect(css).toContain("@keyframes flemo-bar-test-title-fade-PUSHING-false");
    const block = css.slice(css.indexOf("flemo-bar-test-title-fade-PUSHING-false {"));
    expect(block).toContain("opacity: 1"); // from (idle)
    expect(block).toContain("opacity: 0"); // to (enter)
  });

  it("is empty when no bar transitions are passed", () => {
    const css = compileTransitionStyles([], []);
    expect(css).not.toContain("data-flemo-bar-transition-name");
  });
});
