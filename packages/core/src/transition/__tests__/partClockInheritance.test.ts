import { describe, expect, it } from "vitest";

import { compileTransitionStyles, dedupeKeyframeBlocks } from "@transition/compileTransitionStyles";
import createRawTransition from "@transition/createRawTransition";

import createRawPartTransition from "@transition/partTransition/createRawPartTransition";
import { resolvePartClock } from "@transition/partTransition/resolvePartClock";

// A PART DECLARES A POSE, NOT A LENGTH.
//
// How long the hand-over takes is the flight's answer and the flight already
// gave it, so a part with no authored duration runs at the screen's — the rule
// decorators already follow (resolveDecoratorClock), by the same SAME VARIANT
// KEY mapping. Before this, an omitted duration resolved to zero and the part
// SNAPPED under a screen that ran for three quarters of a second, and a part
// authored LONGER than its screen held the whole flight open, which disables
// swipe-back for as long as it runs.

const screen = (name: string, duration: number) =>
  createRawTransition({
    name: name as never,
    initial: { x: "100%" },
    idle: { value: { x: 0 }, options: { duration: 0 } },
    pushOnEnter: { value: { x: 0 }, options: { duration } },
    pushOnExit: { value: { x: "-30%" }, options: { duration } },
    replaceOnEnter: { value: { x: 0 }, options: { duration } },
    replaceOnExit: { value: { x: "-30%" }, options: { duration } },
    // Direction asymmetry, so the inheritance is provably per variant rather
    // than one number copied across the table.
    popOnEnter: { value: { x: "100%" }, options: { duration: duration / 2 } },
    popOnExit: { value: { x: 0 }, options: { duration: duration / 2 } },
    completedOnEnter: { value: { x: 0 }, options: { duration: 0 } },
    completedOnExit: { value: { x: 0 }, options: { duration: 0 } }
  });

/** A part that states only where it starts and ends. */
const poseOnly = createRawPartTransition({
  name: "pose-only" as never,
  initial: { opacity: 0 },
  idle: { value: { opacity: 1 }, options: { duration: 0 } },
  pushOnEnter: { value: { opacity: 1 } },
  pushOnExit: { value: { opacity: 0 } },
  replaceOnEnter: { value: { opacity: 1 } },
  replaceOnExit: { value: { opacity: 0 } },
  popOnEnter: { value: { opacity: 0 } },
  popOnExit: { value: { opacity: 1 } },
  completedOnEnter: { value: { opacity: 1 }, options: { duration: 0 } },
  completedOnExit: { value: { opacity: 0 }, options: { duration: 0 } }
});

// The rule's own body. A compiled block prepends its `@keyframes`, so the
// selector is not where the block starts.
const ruleFor = (css: string, selector: string): string | undefined => {
  const lines = css.split("\n");
  const start = lines.findIndex((line) => line === `${selector} {`);
  if (start === -1) return undefined;
  const end = lines.indexOf("}", start);
  return lines.slice(start, end + 1).join("\n");
};

describe("a part's clock comes from the flight", () => {
  it("fills an omitted duration from the screen's SAME variant", () => {
    const css = compileTransitionStyles([screen("clock-a", 0.7)], [], [poseOnly]);

    const rule = ruleFor(
      css,
      '[data-flemo-transition="clock-a"][data-flemo-part-name="pose-only"]' +
        '[data-flemo-status="PUSHING"][data-flemo-active="true"]'
    );
    expect(rule).toBeDefined();
    expect(rule).toContain("0.7s");
  });

  it("carries the screen's direction asymmetry without the author restating it", () => {
    // The pop half of this screen runs at half the push. A part that named no
    // length gets both, because the mapping is per variant.
    const css = compileTransitionStyles([screen("clock-b", 0.8)], [], [poseOnly]);

    const push = ruleFor(
      css,
      '[data-flemo-transition="clock-b"][data-flemo-part-name="pose-only"]' +
        '[data-flemo-status="PUSHING"][data-flemo-active="true"]'
    );
    const pop = ruleFor(
      css,
      '[data-flemo-transition="clock-b"][data-flemo-part-name="pose-only"]' +
        '[data-flemo-status="POPPING"][data-flemo-active="true"]'
    );
    expect(push).toContain("0.8s");
    expect(pop).toContain("0.4s");
  });

  it("gives the same part a different clock under a different transition", () => {
    // The reason a part cannot be resolved once the way a decorator is: it is
    // referenced by name and may appear under any transition in the Router.
    const css = compileTransitionStyles(
      [screen("clock-fast", 0.2), screen("clock-slow", 1)],
      [],
      [poseOnly]
    );

    expect(
      ruleFor(
        css,
        '[data-flemo-transition="clock-fast"][data-flemo-part-name="pose-only"]' +
          '[data-flemo-status="PUSHING"][data-flemo-active="true"]'
      )
    ).toContain("0.2s");
    expect(
      ruleFor(
        css,
        '[data-flemo-transition="clock-slow"][data-flemo-part-name="pose-only"]' +
          '[data-flemo-status="PUSHING"][data-flemo-active="true"]'
      )
    ).toContain("1s");
  });

  it("leaves an authored length alone", () => {
    const authored = createRawPartTransition({
      name: "authored" as never,
      initial: { opacity: 0 },
      idle: { value: { opacity: 1 }, options: { duration: 0 } },
      pushOnEnter: { value: { opacity: 1 }, options: { duration: 0.12 } },
      pushOnExit: { value: { opacity: 0 }, options: { duration: 0.12 } },
      replaceOnEnter: { value: { opacity: 1 }, options: { duration: 0.12 } },
      replaceOnExit: { value: { opacity: 0 }, options: { duration: 0.12 } },
      popOnEnter: { value: { opacity: 0 }, options: { duration: 0.12 } },
      popOnExit: { value: { opacity: 1 }, options: { duration: 0.12 } },
      completedOnEnter: { value: { opacity: 1 }, options: { duration: 0 } },
      completedOnExit: { value: { opacity: 0 }, options: { duration: 0 } }
    });
    const css = compileTransitionStyles([screen("clock-c", 0.7)], [], [authored]);

    expect(
      ruleFor(
        css,
        '[data-flemo-transition="clock-c"][data-flemo-part-name="authored"]' +
          '[data-flemo-status="PUSHING"][data-flemo-active="true"]'
      )
    ).toContain("0.12s");
  });

  it("keeps an authored zero as the snap the author asked for", () => {
    // `??`, not `||`. A part deliberately written to jump must survive a screen
    // that runs for three quarters of a second.
    const snap = resolvePartClock(screen("clock-d", 0.7), {
      initial: { opacity: 0 },
      variants: {
        ...poseOnly.variants,
        "PUSHING-true": { value: { opacity: 1 }, options: { duration: 0 } }
      }
    });

    expect(snap.variants["PUSHING-true"].options?.duration).toBe(0);
    expect(snap.variants["PUSHING-false"].options?.duration).toBe(0.7);
  });

  it("still emits the by-name rule, which is what a part outside any screen matches", () => {
    // <Part> supports that position on purpose (persistent chrome beside a
    // Slot, a portal). Such a part carries no transition, so only the base
    // selector can reach it, and it keeps exactly what it authored.
    const css = compileTransitionStyles([screen("clock-e", 0.7)], [], [poseOnly]);

    expect(css).toContain(
      '[data-flemo-part-name="pose-only"][data-flemo-status="PUSHING"][data-flemo-active="true"]'
    );
  });
});

describe("dedupeKeyframeBlocks", () => {
  it("keeps one of each identical block and leaves the rules between them", () => {
    // A part's keyframes are its pose, which does not vary with the transition
    // carrying it, so every pair re-emits a byte-identical set.
    const css = [
      "@keyframes a {\n  from {\n    opacity: 0;\n  }\n  to {\n    opacity: 1;\n  }\n}",
      ".one { animation: a; }",
      "@keyframes a {\n  from {\n    opacity: 0;\n  }\n  to {\n    opacity: 1;\n  }\n}",
      ".two { animation: a; }"
    ].join("\n\n");

    const out = dedupeKeyframeBlocks(css);

    expect(out.match(/@keyframes a \{/g)).toHaveLength(1);
    expect(out).toContain(".one { animation: a; }");
    expect(out).toContain(".two { animation: a; }");
  });

  it("keeps two blocks that share a name but differ in body", () => {
    const css = [
      "@keyframes a {\n  from {\n    opacity: 0;\n  }\n}",
      "@keyframes a {\n  from {\n    opacity: 1;\n  }\n}"
    ].join("\n\n");

    expect(dedupeKeyframeBlocks(css).match(/@keyframes a \{/g)).toHaveLength(2);
  });

  it("passes through css with no keyframes at all", () => {
    expect(dedupeKeyframeBlocks(".a { color: red; }")).toBe(".a { color: red; }");
  });

  it("passes through a keyframes header with no body to scan", () => {
    // A truncated sheet has no block to compare, and the pass must hand back
    // what it was given rather than drop the tail looking for a brace.
    const css = ".a { color: red; }\n@keyframes truncated";

    expect(dedupeKeyframeBlocks(css)).toBe(css);
  });
});
