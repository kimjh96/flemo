import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type History, type TransitionName } from "@flemo/core";

import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";
import ScreenMotion from "@screen/ScreenMotion";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// The atomic release flip on DESKTOP macOS SAFARI (`flemo:deskflip`).
//
// That session runs the compiled tier (isDesktopMacWebKit), and WebKit
// presents the compiled clock from the main thread — so the release writes
// `data-flemo-anim-hold="false"` straight onto the DOM inside the readiness rAF
// instead of leaving it to React. The state commit is `flushSync`ed either way,
// so the difference is ORDER INSIDE THE TASK: with the flip the attribute is
// already false when React starts its render/commit work, and the clock's start
// no longer trails that work.
//
// Observed here as the write itself: the flip contributes a `setAttribute` of
// its own ahead of React's, so the scope receives the released value twice with
// the flip and once without it.

const historyEntry = (id: string): History => ({
  id,
  pathname: "/",
  params: {},
  transitionName: "cupertino" as TransitionName
});

const screenContext = (): ScreenContextProps => ({
  id: "top",
  isActive: true,
  isRoot: false,
  isPrev: false,
  zIndex: 1,
  pathname: "/",
  params: {},
  transitionName: "cupertino" as TransitionName,
  prevTransitionName: "cupertino" as TransitionName,
  routePath: "/"
});

describe("ScreenMotion desktop-Safari release flip", () => {
  let stores: FlemoStores;
  let frames: FrameRequestCallback[];
  let holdWrites: { target: Element; value: string }[];

  const asNonBlinkDesktop = (platform: string) => {
    delete (navigator as { userAgentData?: unknown }).userAgentData;
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    Object.defineProperty(navigator, "platform", { value: platform, configurable: true });
  };

  beforeEach(() => {
    // The render-settle gate has its own suite; hold it off so this one
    // observes the release write and nothing else.
    sessionStorage.setItem("flemo:settle-gate", "off");
    stores = createTestStores();
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: "task-1" });
    stores.history.setState({ index: 0, histories: [historyEntry("top")] });
    frames = [];
    holdWrites = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((frameCallback) => {
      frames.push(frameCallback);
      return frames.length;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
    const setAttribute = Element.prototype.setAttribute;
    vi.spyOn(Element.prototype, "setAttribute").mockImplementation(function (
      this: Element,
      name: string,
      value: string
    ) {
      if (name === "data-flemo-anim-hold") holdWrites.push({ target: this, value });
      return setAttribute.call(this, name, value);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
    delete (navigator as unknown as Record<string, unknown>).platform;
  });

  const renderScreen = () => {
    const { getByTestId } = render(
      <StoreContext.Provider value={stores}>
        <ScreenContext.Provider value={screenContext()}>
          <ScreenMotion data-testid="top">
            <div>top</div>
          </ScreenMotion>
        </ScreenContext.Provider>
      </StoreContext.Provider>
    );
    return getByTestId("top");
  };

  // Run the paint anchor's frames, then let the release's microtasks settle.
  const release = async () => {
    await act(async () => {
      frames.splice(0).forEach((frameCallback) => frameCallback(0));
      frames.splice(0).forEach((frameCallback) => frameCallback(16));
      for (let hop = 0; hop < 8; hop++) await Promise.resolve();
    });
  };

  // Every write of the released value that landed on the screen's own scope.
  const releasedWritesOn = (scope: Element) =>
    holdWrites.filter((write) => write.target === scope && write.value === "false");

  it("writes the released hold onto the DOM ahead of React's commit", async () => {
    asNonBlinkDesktop("MacIntel");
    const scope = renderScreen();
    expect(scope.getAttribute("data-flemo-anim-hold")).toBe("true");
    holdWrites.length = 0;

    await release();

    // Two writes of "false": the flip's own, then React reconciling to the
    // same value. Without the flip React's is the only one.
    expect(releasedWritesOn(scope)).toHaveLength(2);
    expect(scope.getAttribute("data-flemo-anim-hold")).toBe("false");
  });

  it("keeps the state-only release under an explicit flemo:deskflip=off", async () => {
    asNonBlinkDesktop("MacIntel");
    sessionStorage.setItem("flemo:deskflip", "off");
    const scope = renderScreen();
    holdWrites.length = 0;

    await release();

    // The opt-out restores the pre-2026-08-20 path — the release reaches the
    // DOM only through React, which is the ordering the flip changes.
    expect(releasedWritesOn(scope)).toHaveLength(1);
    expect(scope.getAttribute("data-flemo-anim-hold")).toBe("false");
  });

  it("leaves a non-Mac desktop session on the state-only release", async () => {
    asNonBlinkDesktop("Win32");
    const scope = renderScreen();
    holdWrites.length = 0;

    await release();

    expect(releasedWritesOn(scope)).toHaveLength(1);
    expect(scope.getAttribute("data-flemo-anim-hold")).toBe("false");
  });
});
