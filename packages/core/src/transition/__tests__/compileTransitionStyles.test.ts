import { describe, expect, it } from "vitest";

import {
  animationName,
  collectAnimatedProperties,
  compileTransitionStyles,
  decoratorAnimationName,
  easingToCss,
  targetToDecls,
  variantHasAnimation
} from "@transition/compileTransitionStyles";
import createTransition from "@transition/createTransition";
import cupertino from "@transition/cupertino";

import layout from "@transition/layout";
import material from "@transition/material";
import none from "@transition/none";

import type { TransitionName, TransitionVariant } from "@transition/typing";

import createDecorator from "@transition/decorator/createDecorator";
import overlay from "@transition/decorator/overlay";
import { resolveDecoratorClock } from "@transition/decorator/resolveDecoratorClock";
import createPartTransition from "@transition/partTransition/createPartTransition";

import type { Decorator, DecoratorName } from "@transition/decorator/typing";

declare module "@transition/typing" {
  interface RegisterTransition {
    "custom-snap-percent": "custom-snap-percent";
    "custom-fade-blur": "custom-fade-blur";
    "custom-slide-fade": "custom-slide-fade";
    "custom-rich-css": "custom-rich-css";
    "custom-unitless": "custom-unitless";
    "custom-lengths": "custom-lengths";
    "custom-css-vars": "custom-css-vars";
    "custom-constant-shadow": "custom-constant-shadow";
  }
}

declare module "@transition/decorator/typing" {
  interface RegisterDecorator {
    "rich-deco": "rich-deco";
    "held-deco": "held-deco";
    "moving-deco": "moving-deco";
    "authored-deco": "authored-deco";
  }
}

// A decorator is compiled through the TRANSITION that names it, and on that
// transition's clock, so a decorator test needs a carrier. `cupertino` is the
// real one for `overlay`; a custom decorator gets a carrier of its own so the
// test picks the span it inherits.
const carrierFor = (decoratorName: DecoratorName, seconds: number) =>
  createTransition({
    name: `carrier-${decoratorName}` as TransitionName,
    initial: { x: "100%" },
    idle: { value: { x: 0 }, options: { duration: 0 } },
    enter: { value: { x: 0 }, options: { duration: seconds } },
    enterBack: { value: { x: "100%" }, options: { duration: seconds } },
    exit: { value: { x: "-30%" }, options: { duration: seconds } },
    exitBack: { value: { x: 0 }, options: { duration: seconds } },
    options: { decoratorName }
  });

// Compile a decorator against a carrier and hand back both the CSS and the
// selector fragment its rules now carry (the pair, not the name alone).
const compileDecorator = (decorator: Decorator, seconds: number) => {
  const carrier = carrierFor(decorator.name, seconds);
  return {
    css: compileTransitionStyles([carrier], [decorator]),
    transitionName: carrier.name,
    // The decorator's variant table with the carrier's clock folded in — the
    // shape the engine reads, and the only one variantHasAnimation accepts.
    clock: resolveDecoratorClock(carrier, decorator)
  };
};

const decoratorSelectorOf = (
  transitionName: string,
  decoratorName: string,
  variant: TransitionVariant
) => {
  const [status, active] = variant.split("-");
  return (
    `[data-flemo-decorator][data-flemo-decorator-name="${decoratorName}"]` +
    `[data-flemo-transition="${transitionName}"]` +
    `[data-flemo-status="${status}"][data-flemo-active="${active}"]`
  );
};

// Every rule body gated on the desktop head's attribute, selector included.
const deskHeadRules = (css: string): string[] =>
  css.match(/:root\[data-flemo-desk-head\][^{]*\{[^}]*\}/g) ?? [];

describe("compileTransitionStyles", () => {
  it("emits a keyframe + rule for the active push entrance", () => {
    const css = compileTransitionStyles([cupertino], []);

    expect(css).toContain(`@keyframes ${animationName("screen", "cupertino", "PUSHING-true")}`);
    expect(css).toContain("transform: translate3d(100%, 0, 0)");
    // Identity target collapses to `transform: none` so the resting scope
    // doesn't create a containing block / stacking context.
    expect(css).toContain("transform: none");
    expect(css).toContain(
      '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="PUSHING"][data-flemo-active="true"]'
    );
    expect(css).toContain("cubic-bezier(0.32, 0.72, 0, 1)");
    expect(css).toContain("0.7s");
  });

  it("emits LITERAL animation timing only — no var()/calc() plumbing", () => {
    const css = compileTransitionStyles([cupertino], []);
    // Device-bisected (2026-08-13): var-dependent timing cost WebKit's
    // compositor playback of screen fades. The LPM birth hold / stretch
    // are applied by the engine as inline literals instead.
    expect(css).not.toContain("--flemo-gov-birth-hold");
    expect(css).not.toContain("--flemo-gov-stretch");
    expect(css).not.toContain("animation-delay: calc(");
    expect(css).not.toContain("animation-duration: calc(");
  });

  it("keeps the authored delay as a literal in the shorthand", () => {
    const staggered = createTransition({
      name: "custom-slide-fade",
      initial: { x: "100%" },
      idle: { value: { x: 0 }, options: { duration: 0 } },
      enter: { value: { x: 0 }, options: { duration: 0.4, delay: 0.15 } },
      exit: { value: { x: "100%" }, options: { duration: 0.4 } },
      enterBack: { value: { x: 0 }, options: { duration: 0.4 } },
      exitBack: { value: { x: "100%" }, options: { duration: 0.4 } }
    });
    const css = compileTransitionStyles([staggered], []);

    expect(css).toMatch(/animation: [^;]*0\.15s[^;]*;/);
  });

  it("keeps the authored duration as a literal in the shorthand", () => {
    const css = compileTransitionStyles([cupertino], []);
    expect(css).toMatch(/animation: [^;]*0\.7s[^;]*;/);
  });

  it("emits no softened-curve rule: front-softening is gone", () => {
    // The compiler used to emit a gentler variant of every front-loaded screen
    // curve behind the governed gate. It was a prescription for a broken
    // pipeline; with that cured it read as a different transition, so the flag
    // went off in 2026-08 and the machinery was deleted with the rAF player.
    const css = compileTransitionStyles([cupertino], []);
    expect(css).not.toContain("animation-timing-function: cubic-bezier(0.4, 0.3, 0.1, 1);");
  });

  it("emits the desktop flat head behind its own gate, sized for a 60Hz pipeline", () => {
    const css = compileTransitionStyles([cupertino], []);
    const kf = `${animationName("screen", "cupertino", "PUSHING-true")}-deskhead`;

    // A 33ms head over cupertino's authored 0.7s push: the rule carries the
    // extended duration and the delay, and the keyframes hold the from-pose
    // across the head — the active-from-birth form, so WebKit's accelerated
    // commit lands inside the invisible head instead of at the first visible
    // frame.
    expect(css).toContain(`@keyframes ${kf} {\n  0%, 4.502% {`);
    const rule = deskHeadRules(css).find((one) => one.includes(kf));
    expect(rule).toBeDefined();
    expect(rule).toContain("animation-duration: 0.733s");
    // The head lives INSIDE the keyframes, so the delay stays authored: a
    // delay of its own would hold the screen for two heads, and this cover is
    // sized to be paid once.
    expect(rule).toContain("animation-delay: 0.000s");
    // Literal timing only — var()/calc() timing lost WebKit's accelerated
    // playback (device-bisected 2026-08-13), which is why there are two heads
    // under two gates instead of one parameterized rule.
    expect(rule).not.toContain("var(");
    // The touch head keeps its own, longer cover under its own attribute.
    expect(css).toContain(
      `animation-name: ${animationName("screen", "cupertino", "PUSHING-true")}-gov`
    );
    expect(css).toContain("animation-delay: 0.100s");
  });

  it("gives the creep head a translateZ hair, whatever the from-pose carries", () => {
    // A transform-carrying variant appends to it; a variant with no transform
    // of its own gets one, because the hair IS the mechanism — the value has to
    // move across the head for the compositor to be carrying the animation when
    // the real motion starts.
    const withTransform = compileTransitionStyles([cupertino], []);
    expect(withTransform).toContain("transform: translate3d(100%, 0, 0) translateZ(0.02px)");

    const opacityOnly = compileTransitionStyles(
      [
        createTransition({
          name: "custom-fade-blur",
          initial: { opacity: 0 },
          idle: { value: { opacity: 1 }, options: { duration: 0 } },
          enter: { value: { opacity: 1 }, options: { duration: 0.3 } },
          enterBack: { value: { opacity: 0 }, options: { duration: 0.3 } },
          exit: { value: { opacity: 0 }, options: { duration: 0.3 } },
          exitBack: { value: { opacity: 1 }, options: { duration: 0.3 } }
        })
      ],
      []
    );
    const creepFrames = opacityOnly
      .split("@keyframes ")
      .find((block) =>
        block.startsWith(`${animationName("screen", "custom-fade-blur", "PUSHING-true")}-govcreep`)
      );
    expect(creepFrames).toContain("transform: translateZ(0.02px)");

    // A variant whose from-pose collapses to `transform: none` gets the hair
    // alone rather than "none translateZ(...)", which would not parse.
    expect(withTransform).not.toContain("transform: none translateZ");
  });

  it("skips the creep head where there is no head to sit in front of", () => {
    // `none` animates nothing, so no variant carries a head — and a part rides
    // the screen's head by delay instead of owning keyframes.
    const nothing = compileTransitionStyles([none], []);
    expect(nothing).not.toContain("-govcreep");

    const partOnly = compileTransitionStyles(
      [],
      [],
      [
        createPartTransition({
          name: "test-title-fade",
          initial: { opacity: 0 },
          idle: { value: { opacity: 1 }, options: { duration: 0.4 } },
          enter: { value: { opacity: 0 }, options: { duration: 0.3 } },
          exit: { value: { opacity: 1 }, options: { duration: 0.3 } }
        })
      ]
    );
    expect(partOnly).not.toContain("-govcreep");
  });

  it("rides parts on the desktop head with a gated literal delay", () => {
    const css = compileTransitionStyles(
      [],
      [],
      [
        createPartTransition({
          name: "test-title-fade",
          initial: { opacity: 0 },
          idle: { value: { opacity: 1 }, options: { duration: 0.4 } },
          enter: { value: { opacity: 0 }, options: { duration: 0.3 } },
          exit: { value: { opacity: 1 }, options: { duration: 0.3 } }
        })
      ]
    );

    const rules = deskHeadRules(css);
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      // Parts never get a head of their own — they ride the screen's by delay,
      // so the choreography's relative timing to the screens survives.
      expect(rule).toContain("animation-delay:");
      expect(rule).not.toContain("animation-name:");
      expect(rule).not.toContain("animation-timing-function");
    }
  });

  it("keeps part easing authored — no LPM ease var outside the screen scope", () => {
    const css = compileTransitionStyles(
      [],
      [],
      [
        createPartTransition({
          name: "test-title-fade",
          initial: { opacity: 0 },
          idle: { value: { opacity: 1 }, options: { duration: 0.4 } },
          enter: { value: { opacity: 0 }, options: { duration: 0.3 } },
          exit: { value: { opacity: 1 }, options: { duration: 0.3 } }
        })
      ]
    );
    // Parts DO get a gated literal-delay ride-along under LPM (the flat
    // head), but never an easing override — their authored curves stay
    // exactly as written.
    expect(css).not.toContain("animation-timing-function: var(");
    for (const block of css.split("\n\n")) {
      if (!block.includes("data-flemo-governed")) continue;
      expect(block).not.toContain("animation-timing-function");
    }
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
    expect(popInactive).toContain("transform: translate3d(-30%, 0, 0)");
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
    expect(pushInactive).toContain("transform: translate3d(0, -56px, 0)");
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

  it("cross-fades both ways for the layout transition", () => {
    // A real fade in each direction, not the 0.97 hair it used to run: that
    // read as a pop on the way in and a hard cut on the way out, which only
    // passed unnoticed while its partner was a transparent screen.
    const css = compileTransitionStyles([layout], []);

    expect(css).toContain(`@keyframes ${animationName("screen", "layout", "PUSHING-true")}`);
    expect(css).toContain("opacity: 0");
    expect(css).toContain("opacity: 1");
  });

  it("animates translateY for material", () => {
    const css = compileTransitionStyles([material], []);

    expect(css).toContain("transform: translate3d(0, 100%, 0)");
    // material's enter/exitBack/idle targets are y: 0 (identity) → collapses
    // to `transform: none` so the resting scope stays free of stacking-context.
    expect(css).toContain("transform: none");
    expect(css).toContain("0.35s");
  });

  it("compiles decorator rules under the decorator selector", () => {
    const css = compileTransitionStyles([cupertino], [overlay]);

    // The visible decorator animation rides on the screen that's moving INTO
    // the background: `PUSHING-false`, not `PUSHING-true`. The entering
    // screen's decorator sits at `idle` and emits only a rest rule.
    expect(css).toContain(
      '[data-flemo-decorator][data-flemo-decorator-name="overlay"][data-flemo-transition="cupertino"][data-flemo-status="PUSHING"][data-flemo-active="false"]'
    );
    expect(css).toContain(
      `@keyframes ${decoratorAnimationName("cupertino", "overlay", "PUSHING-false")}`
    );
  });

  it("emits camelCase CSS props as kebab-case", () => {
    const css = compileTransitionStyles([cupertino], [overlay]);

    expect(css).toContain("background-color: rgba(0, 0, 0, 0.1)");
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

    const { css, transitionName } = compileDecorator(rich, 0.5);
    const keyframe = css
      .split("\n\n")
      .find(
        (block) =>
          block.includes(decoratorAnimationName(transitionName, "rich-deco", "PUSHING-false")) &&
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
    expect(keyframe).toContain("transform: translate3d(-10px, 0, 0) scale(0.98) rotate(2deg)");

    // will-change lists exactly the properties the decorator writes. The
    // compiler emits the keyframe block + the selector rule joined by a single
    // newline (one entry in the `\n\n`-split list), so we assert against the
    // same block.
    expect(keyframe).toContain(decoratorSelectorOf(transitionName, "rich-deco", "PUSHING-false"));
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
    const css = compileTransitionStyles([cupertino], [overlay]);
    // The animating decorator slot is the screen going behind, not the active
    // side. That's where `idle → enter` actually runs and the layer needs
    // promoting.
    const pushInactive = findRule(
      css,
      '[data-flemo-decorator][data-flemo-decorator-name="overlay"][data-flemo-transition="cupertino"][data-flemo-status="PUSHING"][data-flemo-active="false"]'
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
    const css = compileTransitionStyles([cupertino], [overlay]);
    const decoBlock = findRule(
      css,
      '[data-flemo-decorator][data-flemo-decorator-name="overlay"][data-flemo-transition="cupertino"][data-flemo-status="PUSHING"][data-flemo-active="false"]'
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

  it("keeps PUSHING / REPLACING hit-testable while retaining layout containment", () => {
    // Layout containment still isolates heavy mount work, but pointer events
    // must reach the arriving screen. A touch that begins before the animation
    // completes keeps its original target for the whole stream; making the
    // arriving screen non-hit-testable strands the first attempted scroll on
    // the covered screen until the user lifts and tries again.
    const cssCupertino = compileTransitionStyles([cupertino], []);
    const pushActive = findRule(
      cssCupertino,
      '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="PUSHING"][data-flemo-active="true"]'
    );
    expect(pushActive).toBeDefined();
    expect(pushActive).toMatch(/contain:\s*layout;/);
    expect(pushActive).not.toMatch(/pointer-events:\s*none;/);

    const replaceActive = findRule(
      cssCupertino,
      '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="REPLACING"][data-flemo-active="true"]'
    );
    if (replaceActive) {
      expect(replaceActive).toMatch(/contain:\s*layout;/);
      expect(replaceActive).not.toMatch(/pointer-events:\s*none;/);
    }

    // Bar siblings ride under the same block and stay hit-testable too.
    expect(pushActive).toContain("[data-flemo-bar]");

    // The decorator keeps layout containment. ScreenDecorator already owns
    // its non-interactive pointer policy inline.
    const cssOverlay = compileTransitionStyles([cupertino], [overlay]);
    const decoRule = findRule(
      cssOverlay,
      '[data-flemo-decorator][data-flemo-decorator-name="overlay"][data-flemo-transition="cupertino"][data-flemo-status="PUSHING"][data-flemo-active="false"]'
    );
    expect(decoRule).toBeDefined();
    expect(decoRule).toMatch(/contain:\s*layout;/);
    expect(decoRule).not.toMatch(/pointer-events:\s*none;/);
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

  it("returns false for layout's covered screen, which holds still by design", () => {
    // `layout` moves ONE screen at a time: the arriving screen fades in OVER a
    // stationary one, so its whole passive side is authored at `opacity: 1`
    // both ends. It still carries the 0.4s the rest of the preset runs on,
    // which used to be read as motion — the compiler emitted an empty
    // `@keyframes` with a full set of governed and desktop head copies, and
    // the engine counted the screen underneath as a participant it had to wait
    // out on every push, replace and pop.
    expect(variantHasAnimation(layout, "PUSHING-false")).toBe(false);
    expect(variantHasAnimation(layout, "REPLACING-false")).toBe(false);
    expect(variantHasAnimation(layout, "POPPING-false")).toBe(false);
    // The sides that DO move are untouched.
    expect(variantHasAnimation(layout, "PUSHING-true")).toBe(true);
    expect(variantHasAnimation(layout, "POPPING-true")).toBe(true);
  });

  it("emits no keyframes for those variants either", () => {
    const css = compileTransitionStyles([layout], []);
    for (const variant of ["PUSHING-false", "REPLACING-false", "POPPING-false"] as const) {
      expect(css).not.toContain(`@keyframes ${animationName("screen", "layout", variant)}`);
    }
    expect(css).toContain(`@keyframes ${animationName("screen", "layout", "PUSHING-true")}`);
  });
});

declare module "@transition/partTransition/typing" {
  interface RegisterPartTransition {
    "test-title-fade": "test-title-fade";
  }
}

describe("compileTransitionStyles bar transitions", () => {
  const titleFade = createPartTransition({
    name: "test-title-fade",
    initial: { opacity: 0 },
    idle: { value: { opacity: 1 }, options: { duration: 0.4 } },
    enter: { value: { opacity: 0 }, options: { duration: 0.3 } },
    exit: { value: { opacity: 1 }, options: { duration: 0.3 } }
  });

  it("emits per-element selectors keyed by data-flemo-part-name + status + active", () => {
    const css = compileTransitionStyles([], [], [titleFade]);
    expect(css).toContain(
      '[data-flemo-part-name="test-title-fade"][data-flemo-status="PUSHING"][data-flemo-active="true"]'
    );
    // Never paired with the screen ride-along selector (that's screen scope only).
    expect(css).not.toContain("data-flemo-bar-riding");
  });

  it("emits a keyframe in the bar scope for the leaving side fading out", () => {
    const css = compileTransitionStyles([], [], [titleFade]);
    expect(css).toContain("@keyframes flemo-part-test-title-fade-PUSHING-false");
    const block = css.slice(css.indexOf("flemo-part-test-title-fade-PUSHING-false {"));
    expect(block).toContain("opacity: 1"); // from (idle)
    expect(block).toContain("opacity: 0"); // to (enter)
  });

  describe("destination park rules", () => {
    // A full-shove transition: the prev screen exits fully off-screen, so on
    // pop it re-enters from a hidden `from` — the park candidate.
    const shove = createTransition({
      name: "custom-slide-fade",
      initial: { x: "100%" },
      idle: { value: { x: 0 }, options: { duration: 0 } },
      enter: { value: { x: 0 }, options: { duration: 0.4 } },
      // The top leaves to the right on pop; the prev returns to rest (x: 0).
      enterBack: { value: { x: "100%" }, options: { duration: 0.4 } },
      exit: { value: { x: "-100%" }, options: { duration: 0.4 } },
      exitBack: { value: { x: 0 }, options: { duration: 0.4 } }
    });

    it("emits a park rule for the covered entering side (POPPING-false) of a hidden-from variant", () => {
      const css = compileTransitionStyles([shove], []);
      const selector =
        `[data-flemo-screen][data-flemo-transition="custom-slide-fade"]` +
        `[data-flemo-status="POPPING"][data-flemo-active="false"][data-flemo-anim-hold="park"]`;
      const parkIndex = css.indexOf(selector);
      expect(parkIndex).toBeGreaterThan(-1);
      const block = css.slice(parkIndex, css.indexOf("}", parkIndex));
      expect(block).toContain("animation: none");
      // Destination = the enterBack target (x: 0 → identity transform).
      expect(block).toContain("transform: none");
    });

    it("never emits a park rule for the active (covering) side, even with a hidden from", () => {
      const css = compileTransitionStyles([shove], []);
      expect(css).not.toContain(
        `[data-flemo-status="PUSHING"][data-flemo-active="true"][data-flemo-anim-hold="park"]`
      );
    });

    it("does not emit a park rule when the from keeps the screen visible", () => {
      const css = compileTransitionStyles([cupertino], []);
      // cupertino's prev re-enters from x:-30% — visible, must not teleport.
      expect(css).not.toContain(
        `[data-flemo-transition="cupertino"][data-flemo-status="POPPING"][data-flemo-active="false"][data-flemo-anim-hold="park"]`
      );
    });

    it("emits a park-under rule for the active entering side of a hidden-from push", () => {
      const css = compileTransitionStyles([shove], []);
      const selector =
        `[data-flemo-screen][data-flemo-transition="custom-slide-fade"]` +
        `[data-flemo-status="PUSHING"][data-flemo-active="true"][data-flemo-anim-hold="park-under"]`;
      const index = css.indexOf(selector);
      expect(index).toBeGreaterThan(-1);
      const block = css.slice(index, css.indexOf("}", index));
      expect(block).toContain("animation: none");
      // Destination = the enter target (x: 0).
      expect(block).toContain("transform: none");
    });

    it("never emits park-under for a pop variant (the leaving screen is visible)", () => {
      const css = compileTransitionStyles([shove], []);
      expect(css).not.toContain(
        `[data-flemo-status="POPPING"][data-flemo-active="true"][data-flemo-anim-hold="park-under"]`
      );
    });

    it("carries the park pose through the governed head, gated on the binding's mark", () => {
      const css = compileTransitionStyles([shove], []);
      const selector =
        `:root[data-flemo-governed] [data-flemo-screen][data-flemo-transition="custom-slide-fade"]` +
        `[data-flemo-status="PUSHING"][data-flemo-active="true"][data-flemo-park-head="true"]`;
      const index = css.indexOf(selector);
      expect(index).toBeGreaterThan(-1);
      const rule = css.slice(index, css.indexOf("}", index));
      // Out-specifies the plain governed head (one attribute more) and keeps its
      // total and delay, so the visible curve is the same one, started at the
      // same wall-clock moment.
      expect(rule).toContain("animation-name: flemo-screen-custom-slide-fade-PUSHING-true-govpark");
      expect(rule).toContain("animation-duration: 0.500s");
      expect(rule).toContain("animation-delay: 0.100s");

      const kfIndex = css.indexOf("@keyframes flemo-screen-custom-slide-fade-PUSHING-true-govpark");
      const kf = css.slice(kfIndex, css.indexOf("\n}", kfIndex));
      // The head waits at the DESTINATION (x: 0 → identity) at the park's
      // opacity — on-screen, so WebKit keeps its tiles — not at the off-screen
      // from-pose the plain head holds.
      expect(kf).toContain("0.000% {\n    transform: none;\n    opacity: 0.02;");
      // The jump to the from-pose is split so neither sliver can be seen: the
      // move happens at the park's opacity, the opacity is restored off-screen.
      expect(kf).toContain("19.950% {\n    transform: none;\n    opacity: 0.02;");
      expect(kf).toContain(
        "20.000% {\n    transform: translate3d(100%, 0, 0);\n    opacity: 0.02;"
      );
      expect(kf).toContain("20.050% {\n    transform: translate3d(100%, 0, 0);\n    opacity: 1;");
      expect(kf).toContain("100.000% {\n    transform: none;\n    opacity: 1;");
    });

    it("carries the COVERED side's park with the author's own values, adding no opacity", () => {
      // That screen is hidden by the one moving over it, not by an opacity of
      // its own — and that cover is held on the same clock, so it is still
      // covering for the whole head. Nothing needs to be injected, so nothing is.
      const css = compileTransitionStyles([shove], []);
      const kfIndex = css.indexOf(
        "@keyframes flemo-screen-custom-slide-fade-POPPING-false-govpark"
      );
      expect(kfIndex).toBeGreaterThan(-1);
      const kf = css.slice(kfIndex, css.indexOf("\n}", kfIndex));
      expect(kf).not.toContain("opacity");
      expect(kf).toContain("0.000% {\n    transform: none;");
      expect(kf).toContain("100.000% {\n    transform: none;");
    });

    it("releases the concealment back to the AUTHORED opacity, not to 1", () => {
      // The bug this ends, caught in WebKit before it shipped: forcing `1` at the
      // end of the concealment landed a fade fully opaque on the frame after the
      // head (measured 1.00 where the authored curve is at 0.20) — the parked
      // head had deleted the transition it was supposed to be protecting. Where
      // the author animates opacity, releasing means STOPPING, and their own
      // values take over.
      const css = compileTransitionStyles([layout], []);
      const kfIndex = css.indexOf("@keyframes flemo-screen-layout-PUSHING-true-govpark");
      const kf = css.slice(kfIndex, css.indexOf("\n}", kfIndex));
      // Parked at the park's opacity, then straight onto the authored fade: 0 at
      // the from-pose, 1 at the destination. No injected value survives the jump.
      expect(kf).toContain("  0.000% {\n    opacity: 0.02;\n  }");
      expect(kf).toContain("  20.000% {\n    opacity: 0.02;\n  }");
      expect(kf).toContain("  20.050% {\n    opacity: 0;\n  }");
      expect(kf).toContain("  100.000% {\n    opacity: 1;\n  }");
    });

    it("never marks a side that has no park to carry", () => {
      const css = compileTransitionStyles([shove], []);
      // The leaving screen is visible from its first frame: it never parks, so a
      // parked head would be holding it somewhere it was never put.
      expect(css).not.toContain(
        `[data-flemo-status="PUSHING"][data-flemo-active="false"][data-flemo-park-head="true"]`
      );
      // The active side of a pop is the LEAVING top. Parking it at its
      // destination would expose the screen returning underneath.
      expect(css).not.toContain(
        `[data-flemo-status="POPPING"][data-flemo-active="true"][data-flemo-park-head="true"]`
      );
    });

    it("heads a park wherever one is emitted, whatever the author hid the screen with", () => {
      // THE INVARIANT, and the reason it is a test rather than a comment: the
      // park decision and the head that has to carry it were written as two
      // separate condition lists once, and they drifted — the head silently
      // excluded every opacity-authored transition, so `layout` parked and then
      // threw the park away while `cupertino` did not. A consumer authors their
      // own transitions and hides a screen however they like; the two halves
      // must answer the same for every one of them.
      type Pose = Parameters<typeof createTransition>[0]["initial"];
      const hidden = (name: TransitionName, initial: Pose, back: Pose) =>
        createTransition({
          name,
          initial,
          idle: { value: { opacity: 1, scale: 1 }, options: { duration: 0 } },
          enter: { value: { opacity: 1, scale: 1 }, options: { duration: 0.4 } },
          enterBack: { value: back, options: { duration: 0.3 } },
          // A covered side that leaves the viewport entirely, so the pop-side
          // park is exercised too.
          exit: { value: { x: "-100%" }, options: { duration: 0.4 } },
          exitBack: { value: { opacity: 1, scale: 1 }, options: { duration: 0.3 } }
        });

      const authored = [
        cupertino,
        material,
        layout,
        shove,
        // hidden by a translate, by an opacity, and by both at once
        hidden("custom-snap-percent" as TransitionName, { y: "100%" }, { y: "100%" }),
        hidden("custom-fade-blur" as TransitionName, { opacity: 0 }, { opacity: 0 }),
        hidden(
          "custom-slide-fade" as TransitionName,
          { opacity: 0, scale: 0.9 },
          { opacity: 0, scale: 0.9 }
        )
      ];

      for (const transition of authored) {
        const css = compileTransitionStyles([transition], []);
        const variantsOf = (pattern: RegExp) =>
          new Set([...css.matchAll(pattern)].map((match) => `${match[1]}-${match[2]}`));
        const parks = variantsOf(
          /data-flemo-status="(\w+)"\]\[data-flemo-active="(\w+)"\]\[data-flemo-anim-hold="park/g
        );
        const headed = variantsOf(/@keyframes [\w-]+-(\w+)-(\w+)-govpark/g);
        expect([...headed].sort(), (transition as { name: string }).name).toEqual(
          [...parks].sort()
        );
        // And the desktop head gets the same copy: it is a shorter wait, not a
        // different mechanism.
        expect([...variantsOf(/@keyframes [\w-]+-(\w+)-(\w+)-deskpark/g)].sort()).toEqual(
          [...parks].sort()
        );
      }
    });

    it("pauses the park attribute too in the global hold rule (safe fallback)", () => {
      const css = compileTransitionStyles([cupertino], []);
      const holdIndex = css.indexOf('[data-flemo-anim-hold="park"],');
      expect(holdIndex).toBeGreaterThan(-1);
      expect(css).toContain('[data-flemo-anim-hold="park"] [data-flemo-part-name]');
      expect(css).toContain('[data-flemo-anim-hold="park-under"] [data-flemo-part-name]');
    });
  });

  it("is empty when no bar transitions are passed", () => {
    const css = compileTransitionStyles([], []);
    expect(css).not.toContain("@keyframes flemo-part");
    expect(css).not.toContain("[data-flemo-part-name][data-flemo-status");
  });

  it("always appends the animation-hold rule that pauses freshly started animations", () => {
    const css = compileTransitionStyles([cupertino], []);
    const holdIndex = css.indexOf('[data-flemo-anim-hold="true"]');
    expect(holdIndex).toBeGreaterThan(-1);
    const block = css.slice(holdIndex);
    expect(block).toContain("animation-play-state: paused !important");
    // Appended after every animation rule so the pause wins the cascade for
    // the play-state longhand against the variant rules' animation shorthand.
    expect(block).not.toContain("@keyframes");
  });
});

describe("consumer animations", () => {
  it("emits no rule that touches consumer-authored animations", () => {
    const css = compileTransitionStyles([], [], []);
    // The removed quarantine matched non-<Part> descendants (and their
    // pseudo-elements) of cold screens with `animation: none !important`.
    // Nothing in the compiled sheet may reach into the consumer's subtree.
    expect(css).not.toContain(":not([data-flemo-part-name])");
    expect(css).not.toContain("animation: none !important");
  });
});

describe("morph rules", () => {
  it("pauses a morph with the screen carrying it", () => {
    // A morph's keyframes are emitted per flight rather than compiled, but its
    // CLOCK is the one every other participant obeys. This selector is the
    // entire reason a shared element starts on the same frame as its screen
    // with no timing code on either side.
    const css = compileTransitionStyles([cupertino], []);
    expect(css).toContain('[data-flemo-anim-hold="true"] [data-flemo-morph]');
    expect(css).toContain('[data-flemo-anim-hold="park"] [data-flemo-morph]');
    expect(css).toContain('[data-flemo-anim-hold="park-under"] [data-flemo-morph]');
    // The ghost too: it is stripped of every morph marker so nothing mistakes
    // the copy for the real element, which also took it out of the selector
    // above — and a copy that dissolves while the flight is still held is an
    // afterimage of the thing that has not moved yet.
    expect(css).toContain('[data-flemo-anim-hold="true"] [data-flemo-morph-ghost]');
  });
});

describe("in-flight arrival hold rule", () => {
  it("holds stamped arrivals off-glass", () => {
    const css = compileTransitionStyles([], [], []);
    const idx = css.indexOf("[data-flemo-held-arrival]");
    expect(idx).toBeGreaterThan(-1);
    expect(css.slice(idx)).toContain("display: none !important;");
  });
});

describe("targetToDecls", () => {
  it("supports rotate transform parts", () => {
    const decls = targetToDecls({ rotate: "45deg", rotateX: "10deg", rotateY: "20deg" });
    const transform = decls.find((decl) => decl.property === "transform");
    expect(transform?.value).toContain("rotate(45deg)");
    expect(transform?.value).toContain("rotateX(10deg)");
    expect(transform?.value).toContain("rotateY(20deg)");
  });
});

describe("easingToCss", () => {
  it("maps named easings, malformed arrays, and bezier arrays", () => {
    expect(easingToCss("easeInOut")).toBe("ease-in-out");
    expect(easingToCss([0.1, 0.2, 0.3] as never)).toBe("linear");
    expect(easingToCss([0.1, 0.2, 0.3, 0.4])).toBe("cubic-bezier(0.1, 0.2, 0.3, 0.4)");
  });
  // A property with the SAME value on both endpoints of a variant never
  // interpolates — and a keyframe that merely NAMES a property the engine
  // cannot composite is enough to drop the whole animation to the main
  // thread. Engines disagree about that list (Blink only learned to composite
  // background-color in 111), so the compiler keeps constants OUT of the
  // keyframes and applies them from the variant's own rule instead, where the
  // rendered result is identical. This is not an overlay special case: it must
  // hold for every decorator, transition and part an author writes.
  describe("constant properties stay out of the keyframes", () => {
    // A keyframe block ONLY — the emitted sheet puts the element rule right
    // after it in the same paragraph, and that rule is exactly where the
    // constants now live, so a paragraph-level match would prove nothing.
    const keyframeBlockOf = (css: string, name: string) =>
      css.match(new RegExp(`@keyframes ${name} \\{[\\s\\S]*?\\n\\}`))?.[0];
    const ruleBlockOf = (css: string, selectorPart: string) =>
      css
        .split("\n")
        .join("\n")
        .match(
          new RegExp(`[^}]*${selectorPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^{]*\\{[^}]*\\}`)
        )?.[0];

    it("keeps an AUTHORED decorator's constant channel out of its keyframes", () => {
      const held = createDecorator({
        name: "held-deco",
        initial: { opacity: 0, backdropFilter: "saturate(1.4)" },
        idle: { value: { opacity: 0, backdropFilter: "saturate(1.4)" }, options: { duration: 0 } },
        enter: {
          value: { opacity: 1, backdropFilter: "saturate(1.4)" },
          options: { duration: 0.4 }
        },
        exit: { value: { opacity: 0, backdropFilter: "saturate(1.4)" }, options: { duration: 0.4 } }
      });
      const { css, transitionName } = compileDecorator(held, 0.5);
      const keyframe = keyframeBlockOf(
        css,
        decoratorAnimationName(transitionName, "held-deco", "PUSHING-false")
      );

      expect(keyframe).toBeDefined();
      expect(keyframe).toContain("opacity: 1");
      expect(keyframe).not.toContain("backdrop-filter");
      // Still applied — by the rule that runs the animation.
      expect(
        ruleBlockOf(css, decoratorSelectorOf(transitionName, "held-deco", "PUSHING-false"))
      ).toContain("backdrop-filter: saturate(1.4)");
    });

    it("does the same for a screen transition and its parts", () => {
      const shadowed = createTransition({
        name: "custom-constant-shadow",
        initial: { x: "100%", boxShadow: "-2px 0 8px rgba(0,0,0,0.2)" },
        idle: {
          value: { x: 0, boxShadow: "-2px 0 8px rgba(0,0,0,0.2)" },
          options: { duration: 0 }
        },
        enter: {
          value: { x: 0, boxShadow: "-2px 0 8px rgba(0,0,0,0.2)" },
          options: { duration: 0.3 }
        },
        enterBack: {
          value: { x: "100%", boxShadow: "-2px 0 8px rgba(0,0,0,0.2)" },
          options: { duration: 0.3 }
        },
        exit: {
          value: { x: "-30%", boxShadow: "-2px 0 8px rgba(0,0,0,0.2)" },
          options: { duration: 0.3 }
        },
        exitBack: {
          value: { x: 0, boxShadow: "-2px 0 8px rgba(0,0,0,0.2)" },
          options: { duration: 0.3 }
        }
      });
      const part = createPartTransition({
        name: "constant-part",
        initial: { opacity: 0, filter: "blur(2px)" },
        idle: { value: { opacity: 1, filter: "blur(2px)" }, options: { duration: 0 } },
        // `opacity` has to differ on the variant under test (PUSHING-false,
        // which animates from `idle`), or there is no interpolating channel
        // for the constant `filter` to be separated from.
        enter: { value: { opacity: 0, filter: "blur(2px)" }, options: { duration: 0.3 } },
        exit: { value: { opacity: 1, filter: "blur(2px)" }, options: { duration: 0.3 } }
      });
      const css = compileTransitionStyles([shadowed], [], [part]);

      const screenKeyframe = keyframeBlockOf(
        css,
        animationName("screen", "custom-constant-shadow", "PUSHING-true")
      );
      expect(screenKeyframe).toContain("transform: translate3d(100%, 0, 0)");
      expect(screenKeyframe).not.toContain("box-shadow");

      const partKeyframe = keyframeBlockOf(
        css,
        animationName("part", "constant-part", "PUSHING-false")
      );
      expect(partKeyframe).toBeDefined();
      expect(partKeyframe).not.toContain("filter");
      expect(css).toContain("filter: blur(2px)");
    });

    it("leaves a channel that actually changes in the keyframes", () => {
      const css = compileTransitionStyles([cupertino], [overlay]);
      const keyframe = keyframeBlockOf(
        css,
        decoratorAnimationName("cupertino", "overlay", "PUSHING-false")
      );

      // opacity interpolates: it stays. background-color is held: it does not.
      expect(keyframe).toContain("opacity: 0");
      expect(keyframe).toContain("opacity: 1");
      expect(keyframe).not.toContain("background-color");
      expect(css).toContain("background-color: rgba(0, 0, 0, 0.1)");
    });

    // The guarantee an AUTHOR needs, pinned across the whole surface rather
    // than on one variant: whatever a new decorator carries as a constant, no
    // keyframe of it — base, LPM head, creep head, desktop head, any status —
    // may name that channel, and every one of its rules must still apply it.
    // A decorator gets no preset treatment: `overlay` reaches this emitter
    // through the same path a `createDecorator` call does.
    it("holds for EVERY variant and head copy of an authored decorator", () => {
      const authored = createDecorator({
        name: "authored-deco",
        initial: {
          opacity: 0,
          backdropFilter: "saturate(1.2)",
          boxShadow: "0 0 24px rgba(0,0,0,0.3)",
          backgroundColor: "rgba(10, 10, 10, 0.2)"
        },
        idle: {
          value: {
            opacity: 0,
            backdropFilter: "saturate(1.2)",
            boxShadow: "0 0 24px rgba(0,0,0,0.3)",
            backgroundColor: "rgba(10, 10, 10, 0.2)"
          },
          options: { duration: 0 }
        },
        enter: {
          value: {
            opacity: 1,
            backdropFilter: "saturate(1.2)",
            boxShadow: "0 0 24px rgba(0,0,0,0.3)",
            backgroundColor: "rgba(10, 10, 10, 0.2)"
          },
          options: { duration: 0.5 }
        },
        exit: {
          value: {
            opacity: 0,
            backdropFilter: "saturate(1.2)",
            boxShadow: "0 0 24px rgba(0,0,0,0.3)",
            backgroundColor: "rgba(10, 10, 10, 0.2)"
          },
          options: { duration: 0.5 }
        }
      });

      const { css, transitionName } = compileDecorator(authored, 0.5);
      const blocks =
        css.match(
          new RegExp(
            `@keyframes flemo-decorator-${transitionName}--authored-deco[^{]*\\{[\\s\\S]*?\\n\\}`,
            "g"
          )
        ) ?? [];
      // base + lpm + lpmcreep + deskhead, for each animating status.
      expect(blocks.length).toBeGreaterThanOrEqual(4);
      for (const block of blocks) {
        expect(block).toContain("opacity");
        expect(block).not.toContain("backdrop-filter");
        expect(block).not.toContain("box-shadow");
        expect(block).not.toContain("background-color");
      }
      // Every rule that runs one of those keyframes still applies the
      // constants, so the rendered result is unchanged.
      const ruleBlocks =
        css.match(/[^}\n][^}]*\[data-flemo-decorator-name="authored-deco"\][^{]*\{[^}]*\}/g) ?? [];
      const animating = ruleBlocks.filter((rule) => rule.includes("animation: flemo-decorator"));
      expect(animating.length).toBeGreaterThan(0);
      for (const rule of animating) {
        expect(rule).toContain("backdrop-filter: saturate(1.2)");
        expect(rule).toContain("box-shadow: 0 0 24px rgba(0,0,0,0.3)");
        expect(rule).toContain("background-color: rgba(10, 10, 10, 0.2)");
      }
    });

    it("emits a rest rule, not an animation, when EVERY channel is constant", () => {
      // Nothing interpolates here, so there is no motion to compile at any
      // duration and the variant becomes a rest rule holding the constants.
      //
      // The rule this test used to pin was the opposite one: emit the
      // animation anyway, because "the flight resolves on `animationend`" and
      // dropping it would strand the variant until the recovery watchdog
      // replayed it. That reasoning only held while the compiler was the ONE
      // side being changed. `variantHasAnimation` is the single gate every
      // participant decision routes through (the engine's own `hasAnimation`,
      // the passive motion, parts, the decorator, participantLayers), and it
      // now applies the same test — so a variant the compiler declines to
      // animate is never counted as a participant, and there is nothing left
      // to strand. The two sides must be changed together or not at all.
      const stillDeco = createDecorator({
        name: "held-deco",
        initial: { opacity: 0.5, backdropFilter: "saturate(1.4)" },
        idle: {
          value: { opacity: 0.5, backdropFilter: "saturate(1.4)" },
          options: { duration: 0 }
        },
        enter: {
          value: { opacity: 0.5, backdropFilter: "saturate(1.4)" },
          options: { duration: 0.4 }
        },
        exit: {
          value: { opacity: 0.5, backdropFilter: "saturate(1.4)" },
          options: { duration: 0.4 }
        }
      });
      const { css, transitionName, clock } = compileDecorator(stillDeco, 0.4);
      const rule = ruleBlockOf(
        css,
        decoratorSelectorOf(transitionName, "held-deco", "PUSHING-false")
      );

      expect(rule).toContain("animation: none");
      expect(rule).not.toContain(
        decoratorAnimationName(transitionName, "held-deco", "PUSHING-false")
      );
      // The rendered result is unchanged: the rule still holds both channels
      // for exactly the window the variant selector matches.
      expect(rule).toContain("backdrop-filter: saturate(1.4)");
      expect(rule).toContain("opacity: 0.5");
      // ...and the engine agrees, so nothing waits for an animationend that
      // this variant will never fire.
      expect(variantHasAnimation(clock, "PUSHING-false")).toBe(false);
    });

    it("keeps a variant whose endpoints differ on a single channel", () => {
      // The guard against over-reading the rule above: one channel moving is
      // enough, however many others are pinned.
      const movingDeco = createDecorator({
        name: "moving-deco",
        initial: { opacity: 0, backdropFilter: "saturate(1.4)" },
        idle: { value: { opacity: 0, backdropFilter: "saturate(1.4)" }, options: { duration: 0 } },
        enter: {
          value: { opacity: 0.5, backdropFilter: "saturate(1.4)" },
          options: { duration: 0.4 }
        },
        exit: { value: { opacity: 0, backdropFilter: "saturate(1.4)" }, options: { duration: 0.4 } }
      });
      const { css, transitionName, clock } = compileDecorator(movingDeco, 0.4);
      const rule = ruleBlockOf(
        css,
        decoratorSelectorOf(transitionName, "moving-deco", "PUSHING-false")
      );

      expect(rule).toContain(
        `animation: ${decoratorAnimationName(transitionName, "moving-deco", "PUSHING-false")} 0.4s`
      );
      expect(variantHasAnimation(clock, "PUSHING-false")).toBe(true);
    });
  });
});

describe("compileTransitionStyles: <Layer> slot ride-along selector", () => {
  // A slot is a SIBLING of the scope — it has to be, or the screen's transform
  // would trap it exactly like the content it left — so nothing moves it when
  // the screen moves. Pairing it into the screen rule does, off the same
  // @keyframes on the same compositor pass.
  //
  // The failure this pins is the one #344 shipped: an overlay that stayed
  // exactly where it was while its screen slid out from under it, and then
  // vanished at unmount instead of leaving with it.

  const ruleFor = (css: string, selectorSubstring: string): string | undefined => {
    const lines = css.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.startsWith("@keyframes")) continue;
      if (!line.includes(selectorSubstring)) continue;
      let startIdx = i;
      while (startIdx > 0 && lines[startIdx - 1]!.trimEnd().endsWith(",")) startIdx -= 1;
      const collected: string[] = [];
      for (let j = startIdx; j < lines.length; j++) {
        collected.push(lines[j]!);
        if (lines[j]!.trim() === "}") return collected.join("\n");
      }
      return collected.join("\n");
    }
    return undefined;
  };

  it("pairs the screen rule with its slot under one animation block", () => {
    const css = compileTransitionStyles([cupertino], []);
    const pushActive = ruleFor(
      css,
      '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="PUSHING"][data-flemo-active="true"]'
    );

    expect(pushActive).toBeDefined();
    expect(pushActive).toContain(
      '[data-flemo-layer-slot][data-flemo-transition="cupertino"][data-flemo-status="PUSHING"][data-flemo-active="true"]'
    );
    // One declaration for the whole set — screen, riding bar and slot — which
    // is what makes them a single compositor pass rather than three clocks.
    expect((pushActive!.match(/animation:/g) ?? []).length).toBe(1);
    expect((pushActive!.match(/will-change:/g) ?? []).length).toBe(1);
  });

  it("rides on every transitioning variant, unlike a bar", () => {
    const css = compileTransitionStyles([cupertino], []);
    const variants: Array<[string, string]> = [
      ["PUSHING", "true"],
      ["PUSHING", "false"],
      ["POPPING", "true"],
      ["POPPING", "false"]
    ];

    for (const [status, active] of variants) {
      const rule = ruleFor(
        css,
        `[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="${status}"][data-flemo-active="${active}"]`
      );
      expect(rule).toBeDefined();
      // No riding flag in the selector, and that is the difference from a bar:
      // a bar rides only when its partner screen does not own it, while an
      // overlay has exactly one screen and always leaves with it.
      expect(rule).toContain(
        `[data-flemo-layer-slot][data-flemo-transition="cupertino"][data-flemo-status="${status}"][data-flemo-active="${active}"]`
      );
    }
  });

  it("leaves the decorator alone", () => {
    const css = compileTransitionStyles([cupertino], [overlay]);
    const decoBlock = ruleFor(
      css,
      '[data-flemo-decorator-name="overlay"][data-flemo-transition="cupertino"][data-flemo-status="PUSHING"][data-flemo-active="false"]'
    );

    // The dim belongs to the screen and is rendered inside its container, so
    // it needs no pairing. Adding one would animate it twice.
    expect(decoBlock).not.toContain("data-flemo-layer-slot");
  });
});

describe("a shared bar's ride distance", () => {
  // THE BUG: a rider runs the screen's keyframes on its OWN box, and
  // `translate` resolves a percentage against the box it lands on. A shared bar
  // is as wide as its screen but only as tall as its content, so under
  // material's `y: "100%"` a 104px bar crossed 104px while its 770px screen
  // crossed 770px — same clock, one seventh of the distance — and the bar
  // landed alone at the top of a screen still off the bottom of the viewport.
  //
  // Measured on the built package before and after, chromium, 588x770 window,
  // material push into a screen with a shared top bar: the bar's translate
  // divided by the screen's was 0.135 (= 104 / 770) on every sampled frame
  // before, and 1.000 on every sampled frame after.

  const keyframesFor = (css: string, name: string): string | undefined => {
    const start = css.indexOf(`@keyframes ${name} {`);
    if (start === -1) return undefined;
    const end = css.indexOf("\n}", start);
    return css.slice(start, end + 2);
  };

  const ruleFor = (css: string, selectorSubstring: string): string | undefined => {
    const lines = css.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.startsWith("@keyframes")) continue;
      if (!line.includes(selectorSubstring)) continue;
      let startIdx = i;
      while (startIdx > 0 && lines[startIdx - 1]!.trimEnd().endsWith(",")) startIdx -= 1;
      const collected: string[] = [];
      for (let j = startIdx; j < lines.length; j++) {
        collected.push(lines[j]!);
        if (lines[j]!.trim() === "}") return collected.join("\n");
      }
      return collected.join("\n");
    }
    return undefined;
  };

  it("gives the bar its own keyframes, against the screen box, for a percentage y", () => {
    const css = compileTransitionStyles([material], []);

    expect(keyframesFor(css, "flemo-screen-material-PUSHING-true-ride")).toContain(
      "transform: translate3d(0, var(--flemo-ride-y, 100%), 0);"
    );
    const rule = ruleFor(
      css,
      '[data-flemo-bar][data-flemo-bar-transition="material"][data-flemo-bar-status="PUSHING"][data-flemo-bar-active="true"][data-flemo-bar-riding="true"]'
    );
    expect(rule).toContain("animation: flemo-screen-material-PUSHING-true-ride 0.35s");
  });

  it("keeps the screen's own keyframes literal", () => {
    // The var() lives on the bar and nowhere else. This repository has already
    // lost WebKit's accelerated playback once to custom properties inside the
    // animation machinery, so the flagship path stays free of them.
    const css = compileTransitionStyles([material], []);

    expect(keyframesFor(css, "flemo-screen-material-PUSHING-true")).toContain(
      "transform: translate3d(0, 100%, 0);"
    );
    expect(keyframesFor(css, "flemo-screen-material-PUSHING-true")).not.toContain("var(");
  });

  it("takes the bar out of the shared rule when it has a copy, so neither shadows the other", () => {
    const css = compileTransitionStyles([material], []);
    const rule = ruleFor(
      css,
      '[data-flemo-screen][data-flemo-transition="material"][data-flemo-status="PUSHING"][data-flemo-active="true"]'
    );

    expect(rule).toContain("data-flemo-layer-slot");
    expect(rule).not.toContain("data-flemo-bar");
  });

  it("copies the governed, creep and desktop heads onto the bar too", () => {
    // A rider that keeps the screen's clock but loses its lead-in would start
    // moving before the screen it belongs to.
    const css = compileTransitionStyles([material], []);

    for (const suffix of ["gov", "govcreep", "deskhead"]) {
      expect(keyframesFor(css, `flemo-screen-material-PUSHING-true-ride-${suffix}`)).toContain(
        "var(--flemo-ride-y, 100%)"
      );
    }
  });

  it("emits no copy for a horizontal transition: a bar is already the screen's width", () => {
    const css = compileTransitionStyles([cupertino], []);

    expect(css).not.toContain("-ride");
    expect(css).not.toContain("--flemo-ride-y");
    // And the bar keeps its seat in the shared rule.
    expect(
      ruleFor(
        css,
        '[data-flemo-screen][data-flemo-transition="cupertino"][data-flemo-status="PUSHING"][data-flemo-active="true"]'
      )
    ).toContain("data-flemo-bar");
  });

  it("corrects a zero-duration variant too, which snaps rather than animates", () => {
    // A snap writes the target straight onto the element with `animation: none`,
    // so a percentage there is just as wrong on a bar as one inside keyframes.
    // No shipped preset reaches this (every 0-duration variant they author
    // settles at `y: 0`), but an author can write one.
    const snapper = createTransition({
      name: "custom-snap-percent",
      initial: { y: 0 },
      idle: { value: { y: 0 }, options: { duration: 0 } },
      enter: { value: { y: 0 }, options: { duration: 0.3 } },
      exit: { value: { y: 0 }, options: { duration: 0.3 } },
      enterBack: { value: { y: 0 }, options: { duration: 0.3 } },
      exitBack: { value: { y: "100%" }, options: { duration: 0 } }
    });
    const css = compileTransitionStyles([snapper], []);
    const barRule = ruleFor(
      css,
      '[data-flemo-bar][data-flemo-bar-transition="custom-snap-percent"][data-flemo-bar-status="POPPING"][data-flemo-bar-active="false"]'
    );
    const screenRule = ruleFor(
      css,
      '[data-flemo-screen][data-flemo-transition="custom-snap-percent"][data-flemo-status="POPPING"][data-flemo-active="false"]'
    );

    expect(barRule).toContain("transform: translate3d(0, var(--flemo-ride-y, 100%), 0);");
    expect(barRule).toContain("animation: none;");
    expect(screenRule).toContain("transform: translate3d(0, 100%, 0);");
    expect(screenRule).not.toContain("data-flemo-bar");
  });

  it("emits no copy for a pixel offset", () => {
    // material's exit is `y: -56`, an absolute length that already means the
    // same thing on either box.
    const css = compileTransitionStyles([material], []);
    const rule = ruleFor(
      css,
      '[data-flemo-screen][data-flemo-transition="material"][data-flemo-status="PUSHING"][data-flemo-active="false"]'
    );

    expect(rule).toContain("data-flemo-bar");
    expect(keyframesFor(css, "flemo-screen-material-PUSHING-false-ride")).toBeUndefined();
  });
});
