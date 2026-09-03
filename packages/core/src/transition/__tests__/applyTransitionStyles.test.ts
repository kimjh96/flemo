import { afterEach, describe, expect, it, vi } from "vitest";

import applyTransitionStyles from "@transition/applyTransitionStyles";
import cupertino from "@transition/cupertino";
import { transitionMap } from "@transition/transition";

// The compiler is counted rather than spied on: `applyTransitionStyles` holds a
// direct import binding, so replacing the export is the only way to see it.
const compiles = vi.hoisted(() => ({ count: 0 }));
vi.mock("@transition/compileTransitionStyles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@transition/compileTransitionStyles")>();
  return {
    ...actual,
    compileTransitionStyles: (...args: Parameters<typeof actual.compileTransitionStyles>) => {
      compiles.count += 1;
      return actual.compileTransitionStyles(...args);
    }
  };
});

afterEach(() => {
  document.head.querySelector("style[data-flemo]")?.remove();
});

describe("applyTransitionStyles", () => {
  it("creates a single <style data-flemo> tag with compiled CSS", () => {
    applyTransitionStyles();
    const tags = document.head.querySelectorAll("style[data-flemo]");
    expect(tags).toHaveLength(1);
    expect(tags[0].textContent).toContain("@keyframes");
  });

  it("reuses the same tag on repeated calls (no duplicate styles)", () => {
    applyTransitionStyles();
    const first = document.head.querySelector("style[data-flemo]");
    applyTransitionStyles();
    expect(document.head.querySelectorAll("style[data-flemo]")).toHaveLength(1);
    expect(document.head.querySelector("style[data-flemo]")).toBe(first);
  });
});

describe("the compile is keyed on what is registered", () => {
  // A binding registers from an effect keyed on the arrays it was handed, and
  // the natural way to hand them over is a literal — a new array on every
  // render. So the effect tears down and runs again for definitions that did
  // not change: unregister, recompile, register, recompile. Compiling every
  // keyframe of every transition twice per render, per mounted Router, was one
  // 237ms self-time frame per navigation on the site's own shell.
  const probe = { ...cupertino, name: "apply-styles-probe" as never };

  it("compiles once for a registry that has not changed", () => {
    applyTransitionStyles();
    const after = compiles.count;
    applyTransitionStyles();
    applyTransitionStyles();

    expect(compiles.count).toBe(after);
  });

  it("compiles for a registry it has not seen, and reuses one it has", () => {
    applyTransitionStyles();
    const base = compiles.count;

    transitionMap.set(probe.name, probe);
    applyTransitionStyles();
    const withProbe = document.head.querySelector("style[data-flemo]")!.textContent;
    expect(compiles.count).toBe(base + 1);

    // The teardown half of the churn: back to a registry already compiled for.
    transitionMap.delete(probe.name);
    applyTransitionStyles();
    expect(compiles.count).toBe(base + 1);

    // And the register half again, which is where the cost used to land.
    transitionMap.set(probe.name, probe);
    applyTransitionStyles();
    expect(compiles.count).toBe(base + 1);
    expect(document.head.querySelector("style[data-flemo]")!.textContent).toBe(withProbe);

    transitionMap.delete(probe.name);
    applyTransitionStyles();
  });

  it("compiles again when a name carries a different definition", () => {
    transitionMap.set(probe.name, probe);
    applyTransitionStyles();
    const base = compiles.count;

    // Same name, a different object: a hot reload, or a consumer swapping one
    // at runtime. Keying on the name alone would report no change.
    transitionMap.set(probe.name, { ...probe });
    applyTransitionStyles();
    expect(compiles.count).toBe(base + 1);

    transitionMap.delete(probe.name);
    applyTransitionStyles();
  });
});

describe("the cache is bounded", () => {
  it("drops its oldest signature rather than growing without limit", () => {
    // Four entries leave room for a nested Router's churn to interleave with
    // its parent's; a fifth registry evicts the first.
    const probes = [1, 2, 3, 4, 5].map((n) => ({
      ...cupertino,
      name: `apply-styles-limit-${n}` as never
    }));
    applyTransitionStyles();
    for (const probe of probes) {
      transitionMap.set(probe.name, probe);
      applyTransitionStyles();
    }
    for (const probe of probes) transitionMap.delete(probe.name);

    const base = compiles.count;
    applyTransitionStyles();

    // The bare registry was the first signature in and is gone, so it compiles.
    expect(compiles.count).toBe(base + 1);
  });
});
