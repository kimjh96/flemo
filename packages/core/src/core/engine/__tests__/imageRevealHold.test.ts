import { afterEach, describe, expect, it, vi } from "vitest";

import { beginImageRevealHold } from "@core/engine/imageRevealHold";

// jsdom never actually loads an <img>, so a fresh one is "unpainted"
// (complete=false / naturalWidth=0) — exactly the state the hold targets. A
// painted image is simulated by defining complete/naturalWidth.
const paint = (img: HTMLImageElement) => {
  Object.defineProperty(img, "complete", { value: true, configurable: true });
  Object.defineProperty(img, "naturalWidth", { value: 120, configurable: true });
};

const flushObserver = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("imageRevealHold", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("holds an unpainted image out of the render tree and reveals it at release", () => {
    const scope = document.createElement("div");
    const img = document.createElement("img");
    scope.appendChild(img);
    document.body.appendChild(scope);

    // display:none (not visibility:hidden): a hidden-but-displayed image is
    // still laid out, decoded, and its texture uploaded — the very cost the
    // hold removes — so it must leave the render tree entirely.
    const release = beginImageRevealHold(scope, 2000);
    expect(img.style.display).toBe("none");
    expect(img.hasAttribute("data-flemo-img-hold")).toBe(true);

    release();
    expect(img.style.display).toBe("");
    expect(img.hasAttribute("data-flemo-img-hold")).toBe(false);
  });

  it("never hides an already-painted image (it is part of the frozen texture)", () => {
    const scope = document.createElement("div");
    const img = document.createElement("img");
    paint(img);
    scope.appendChild(img);
    document.body.appendChild(scope);

    const release = beginImageRevealHold(scope, 2000);
    expect(img.style.display).toBe("");
    release();
  });

  it("restores the consumer's own inline display exactly", () => {
    const scope = document.createElement("div");
    const img = document.createElement("img");
    img.style.display = "block";
    scope.appendChild(img);
    document.body.appendChild(scope);

    const release = beginImageRevealHold(scope, 2000);
    expect(img.style.display).toBe("none");
    release();
    expect(img.style.display).toBe("block");
  });

  it("holds an <img> inserted mid-flight (a data commit's own image)", async () => {
    const scope = document.createElement("div");
    document.body.appendChild(scope);

    const release = beginImageRevealHold(scope, 2000);
    const late = document.createElement("img");
    scope.appendChild(late);
    await flushObserver();

    expect(late.style.display).toBe("none");
    release();
    expect(late.style.display).toBe("");
  });

  it("reveals via the flight-span backstop if the release never lands", () => {
    vi.useFakeTimers();
    const scope = document.createElement("div");
    const img = document.createElement("img");
    scope.appendChild(img);
    document.body.appendChild(scope);

    beginImageRevealHold(scope, 800);
    expect(img.style.display).toBe("none");
    vi.advanceTimersByTime(800);
    expect(img.style.display).toBe("");
  });

  it("is a no-op for a null scope", () => {
    expect(() => beginImageRevealHold(null, 2000)()).not.toThrow();
  });
});
