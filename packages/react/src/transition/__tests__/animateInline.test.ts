import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import animateInline, { clearInlineAnimation } from "@transition/animateInline";

const newDiv = () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
};

describe("animateInline", () => {
  let el: HTMLDivElement;
  beforeEach(() => {
    el = newDiv();
  });
  afterEach(() => {
    el.remove();
    vi.useRealTimers();
  });

  it("resolves immediately with duration 0 + no inline transition", async () => {
    await animateInline(el, { x: 100, opacity: 0.5 }, { duration: 0 });
    expect(el.style.transform).toContain("translateX(100px)");
    expect(el.style.opacity).toBe("0.5");
    expect(el.style.transition).toBe("none");
  });

  it("sets inline transition for nonzero duration and resolves on transitionend", async () => {
    const animation = animateInline(el, { x: 200 }, { duration: 0.3, ease: "easeOut" });

    // After the next tick, the inline `transition` should be primed and the
    // target value applied.
    await Promise.resolve();
    expect(el.style.transition).toContain("transform 0.3s");
    expect(el.style.transform).toContain("translateX(200px)");

    // Dispatch transitionend manually to settle the promise.
    el.dispatchEvent(new Event("transitionend", { bubbles: true }));
    await expect(animation).resolves.toBeUndefined();
  });

  it("falls back to a safety timeout when transitionend never fires", async () => {
    vi.useFakeTimers();
    const animation = animateInline(el, { x: 50 }, { duration: 0.05 });
    // Advance past `duration + 60ms` safety margin.
    await vi.advanceTimersByTimeAsync(200);
    await expect(animation).resolves.toBeUndefined();
  });

  it("ignores non-HTMLElement targets without throwing", async () => {
    await expect(
      // @ts-expect-error — deliberately wrong type
      animateInline(null, { x: 0 }, { duration: 0.1 })
    ).resolves.toBeUndefined();
  });

  it("clearInlineAnimation strips transform + opacity by default", () => {
    el.style.transform = "translateX(50px)";
    el.style.opacity = "0.5";
    el.style.transition = "transform 0.3s ease";
    clearInlineAnimation(el);
    expect(el.style.transform).toBe("");
    expect(el.style.opacity).toBe("");
    expect(el.style.transition).toBe("");
  });

  it("clearInlineAnimation with an explicit property list strips only those", () => {
    el.style.transform = "translateX(50px)";
    el.style.opacity = "0.5";
    clearInlineAnimation(el, ["transform"]);
    expect(el.style.transform).toBe("");
    // opacity untouched
    expect(el.style.opacity).toBe("0.5");
  });
});
