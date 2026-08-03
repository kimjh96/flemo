import { describe, expect, it, vi } from "vitest";

import { transitionMap } from "@transition/transition";

import createTransitionEngine from "@core/engine/createTransitionEngine";
import { stampAsyncImageDecode } from "@core/engine/imageDecodeHygiene";

// Async-decode stamping (imageDecodeHygiene.ts): a transitional screen's
// images decode OFF the paint critical path, so a huge cross-origin source
// (the device-measured 37MP portrait) can no longer freeze flight frames.

describe("stampAsyncImageDecode", () => {
  it("stamps decoding=async on images the consumer left unspecified", () => {
    const scope = document.createElement("div");
    scope.innerHTML = `<div><img id="a" src="x.jpg" /></div><img id="b" src="y.jpg" />`;
    stampAsyncImageDecode(scope);
    expect(scope.querySelector("#a")!.getAttribute("decoding")).toBe("async");
    expect(scope.querySelector("#b")!.getAttribute("decoding")).toBe("async");
  });

  it("never overrides a consumer-authored decoding attribute", () => {
    const scope = document.createElement("div");
    scope.innerHTML = `<img id="s" src="x.jpg" decoding="sync" /><img id="auto" src="y.jpg" decoding="auto" />`;
    stampAsyncImageDecode(scope);
    expect(scope.querySelector("#s")!.getAttribute("decoding")).toBe("sync");
    expect(scope.querySelector("#auto")!.getAttribute("decoding")).toBe("auto");
  });
});

describe("engine wiring", () => {
  it("a transitional drive stamps the screen's images", () => {
    const scope = document.createElement("div");
    scope.innerHTML = `<img src="portrait.jpg" />`;
    document.body.appendChild(scope);
    const engine = createTransitionEngine({
      getTransitionTaskId: vi.fn(() => null),
      setDragStatus: vi.fn(),
      setReplaceTransitionStatus: vi.fn()
    });
    expect(transitionMap.get("cupertino")).toBeTruthy();
    const cleanup = engine.driveScreenLifecycle({
      getElements: () => ({ scope, decorator: null, bars: [] }),
      transitionName: "cupertino" as never,
      prevTransitionName: "cupertino" as never,
      status: "PUSHING",
      isActive: true,
      animHoldReleased: true
    });
    expect(scope.querySelector("img")!.getAttribute("decoding")).toBe("async");
    cleanup();
    scope.remove();
  });
});
