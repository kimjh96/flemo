import { afterEach, describe, expect, it } from "vitest";

import applyTransitionStyles from "@transition/applyTransitionStyles";

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
