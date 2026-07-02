import { parse } from "path-to-regexp";
import { describe, expect, it } from "vitest";

import animateInline from "@transition/animateInline";

import { easingToCss, targetToDecls } from "@transition/compileTransitionStyles";
import registerTransitionDefinitions from "@transition/registerTransitionDefinitions";

import resolveTransition from "@transition/resolveTransition";

import buildRoutePath from "@utils/buildRoutePath";

import createPartTransition from "@transition/partTransition/createPartTransition";

import { partTransitionMap } from "@transition/partTransition/partTransition";

declare module "@transition/partTransition/typing" {
  interface RegisterPartTransition {
    "coverage-branch-part": "coverage-branch-part";
  }
}

describe("resolveTransition", () => {
  it("falls back to the built-in none for an unregistered name", () => {
    expect(resolveTransition("definitely-not-registered" as never).name).toBe("none");
  });

  it("returns the registered transition", () => {
    expect(resolveTransition("cupertino" as never).name).toBe("cupertino");
  });
});

describe("registerTransitionDefinitions with part transitions", () => {
  it("registers and unregisters part transitions too", () => {
    const part = createPartTransition({
      name: "coverage-branch-part",
      initial: { opacity: 1 },
      idle: { value: { opacity: 1 }, options: { duration: 0 } },
      enter: { value: { opacity: 0 }, options: { duration: 0.2 } },
      exit: { value: { opacity: 1 }, options: { duration: 0.2 } }
    });

    const cleanup = registerTransitionDefinitions([], [], [part]);
    expect(partTransitionMap.has("coverage-branch-part")).toBe(true);
    cleanup();
    expect(partTransitionMap.has("coverage-branch-part")).toBe(false);
  });
});

describe("animateInline branches", () => {
  it("resolves immediately when there is nothing to animate", async () => {
    const el = document.createElement("div");
    await animateInline(el, {});
    expect(el.style.transition).toBe("");
  });

  it("snaps instantly for a zero duration", async () => {
    const el = document.createElement("div");
    await animateInline(el, { opacity: 0.5 }, { duration: 0 });
    expect(el.style.transition).toBe("none");
    expect(el.style.opacity).toBe("0.5");
  });

  it("supports rotate transform parts", () => {
    const decls = targetToDecls({ rotate: "45deg", rotateX: "10deg", rotateY: "20deg" });
    const transform = decls.find((d) => d.property === "transform");
    expect(transform?.value).toContain("rotate(45deg)");
    expect(transform?.value).toContain("rotateX(10deg)");
    expect(transform?.value).toContain("rotateY(20deg)");
  });
});

describe("easingToCss branches", () => {
  it("maps named easings, malformed arrays, and bezier arrays", () => {
    expect(easingToCss("easeInOut")).toBe("ease-in-out");
    expect(easingToCss([0.1, 0.2, 0.3] as never)).toBe("linear");
    expect(easingToCss([0.1, 0.2, 0.3, 0.4])).toBe("cubic-bezier(0.1, 0.2, 0.3, 0.4)");
  });
});

describe("buildRoutePath with a pre-parsed path", () => {
  it("accepts token data instead of a string pattern", () => {
    const result = buildRoutePath(parse("/posts/:id"), { id: "7", tab: "x" });
    expect(result.toPathname).toBe("/posts/7");
    expect(result.pathname).toBe("/posts/7?tab=x");
  });
});
