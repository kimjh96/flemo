import { afterEach, describe, expect, it, vi } from "vitest";

import { easingToCss } from "@transition/compileTransitionStyles";
import { easeControlPoints, resolveEasing } from "@transition/cubicBezier";
import {
  AUTHORED_EASING_NAMES,
  cssEasingPoints,
  isCssEasing,
  namedEasePoints
} from "@transition/easing";

import { resetDevWarningsForTesting } from "@utils/devWarn";

// AN AUTHORED EASING IS EITHER UNDERSTOOD OR REPORTED, never quietly replaced.
//
// Both halves of flemo read an ease: the compiler turns it into a CSS string
// and the sampler turns it into control points (for the perceptual cut and the
// swipe release). Both used to be total lookups over the same hand-copied
// table, so a string neither knew became `ease` in both, silently. That took
// every CSS easing a web author would type — `ease-out`, `cubic-bezier(...)`,
// `steps(...)`, and `linear(...)`, which is how a spring ships in CSS — and
// animated a different curve without a word.
describe("authored easings", () => {
  afterEach(() => {
    resetDevWarningsForTesting();
    vi.restoreAllMocks();
  });

  it("passes CSS easings through to the keyframe", () => {
    expect(easingToCss("ease-out")).toBe("ease-out");
    expect(easingToCss("step-end")).toBe("step-end");
    expect(easingToCss("cubic-bezier(0.2, 0, 0, 1)")).toBe("cubic-bezier(0.2, 0, 0, 1)");
    expect(easingToCss("steps(4, end)")).toBe("steps(4, end)");
    expect(easingToCss("linear(0, 0.3, 0.8, 1)")).toBe("linear(0, 0.3, 0.8, 1)");
  });

  it("keeps flemo's own names, and the CSS spelling of the three that have one", () => {
    expect(easingToCss("easeInOut")).toBe("ease-in-out");
    expect(easingToCss("linear")).toBe("linear");
    expect(easingToCss("anticipate")).toBe("cubic-bezier(0.36, 0, 0.66, -0.56)");
    expect(easingToCss([0.32, 0.72, 0, 1])).toBe("cubic-bezier(0.32, 0.72, 0, 1)");
  });

  it("says so, once, when it does not know the name", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(easingToCss("springy" as never)).toBe("ease");
    expect(easingToCss("springy" as never)).toBe("ease");
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]?.[0])).toContain("springy");
  });

  it("samples the curve the compiler emitted, not a different one", () => {
    // The same bezier, written both ways, must sample identically.
    const asArray = resolveEasing([0.2, 0, 0, 1]);
    const asString = resolveEasing("cubic-bezier(0.2, 0, 0, 1)");
    for (const at of [0.1, 0.35, 0.5, 0.8]) {
      expect(asString(at)).toBeCloseTo(asArray(at), 6);
    }
    expect(easeControlPoints("cubic-bezier(0.2, 0, 0, 1)")).toEqual([0.2, 0, 0, 1]);
    // Both spellings of a named ease agree.
    expect(easeControlPoints("ease-out")).toEqual(easeControlPoints("easeOut"));
  });

  it("treats the CSS forms with no handles as straight, which is what `linear` always was", () => {
    expect(easeControlPoints("linear(0, 0.3, 1)")).toBeNull();
    expect(easeControlPoints("steps(4, end)")).toBeNull();
    expect(easeControlPoints("linear")).toBeNull();
    expect(resolveEasing("linear(0, 0.3, 1)")(0.42)).toBeCloseTo(0.42, 6);
  });

  // The union an author is offered is derived from this list, so anything in it
  // that the compiler did not understand would be a name the types promise and
  // the runtime warns about.
  it("understands every name its own type offers", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const name of AUTHORED_EASING_NAMES) {
      expect(typeof easingToCss(name)).toBe("string");
    }
    expect(error).not.toHaveBeenCalled();
  });

  it("keeps one table behind both halves", () => {
    expect(namedEasePoints("easeOut")).toEqual([0, 0, 0.58, 1]);
    expect(namedEasePoints("nope")).toBeNull();
    expect(isCssEasing("ease-in-out")).toBe(true);
    expect(isCssEasing("easeInOut")).toBe(false);
    expect(cssEasingPoints("cubic-bezier(1, 2, 3)")).toBeNull();
  });
});
