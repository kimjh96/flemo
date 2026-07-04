import { createElement, type PropsWithChildren, type ReactNode } from "react";

import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { History, SharedBarPresence, TransitionName } from "@flemo/core";

import Screen from "@screen/Screen";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";
import ScreenViewportContext from "@screen/ScreenViewportContext";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// Screen derives its freeze decision from the history index plus the navigate/screen stores, then
// renders ScreenFreeze > ScreenMotion. Drive those stores through a request-scoped bundle and the
// active screen through ScreenContext so the component mounts the same way it does under <Router>.

let stores: FlemoStores;

beforeEach(() => {
  stores = createTestStores();
  stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
});

function buildHarness(overrides: Partial<ScreenContextProps> = {}) {
  const screen: ScreenContextProps = {
    id: "screen-1",
    isActive: true,
    isRoot: true,
    isPrev: false,
    zIndex: 0,
    pathname: "/posts/1",
    params: { id: "1" },
    transitionName: "cupertino" as TransitionName,
    prevTransitionName: "cupertino" as TransitionName,
    layoutId: null,
    routePath: "/posts/:id",
    ...overrides
  };

  return function Harness({ children }: PropsWithChildren): ReactNode {
    return createElement(
      StoreContext.Provider,
      { value: stores },
      createElement(ScreenContext.Provider, { value: screen }, children)
    );
  };
}

describe("Screen", () => {
  it("renders its children for the active screen", () => {
    stores.history.setState({ index: 0, histories: [] });

    const { getByTestId } = render(
      <Screen>
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true }) }
    );

    expect(getByTestId("content")).toBeDefined();
  });

  it("freezes an inactive screen once its transition has settled (children hidden, kept mounted)", () => {
    stores.history.setState({ index: 1, histories: [] });

    const { getByTestId } = render(
      <Screen>
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: false }) }
    );

    // Frozen screens stay mounted (so they don't lose state) but are display:none.
    const content = getByTestId("content");
    expect(content).toBeDefined();
    const freezeWrapper = content.closest("div[style*='display']");
    expect(freezeWrapper).not.toBeNull();
  });

  // The "settled" clause is short-circuited away while a transition is mid-flight
  // (status !== COMPLETED), so the isPrev clauses decide whether a prev screen
  // stays frozen during a replace/pop. The prev screen sits one entry below the
  // top: zIndex 0, history index 2.
  it("keeps the prev screen frozen during a replace when it sits at-or-below the top (replaceTransitionStatus IDLE)", () => {
    stores.navigate.setState({ status: "POPPING", transitionTaskId: null });
    stores.screen.setState({ replaceTransitionStatus: "IDLE" });
    // index - 2 === zIndex (0), and replaceTransitionStatus is IDLE → frozen.
    stores.history.setState({ index: 2, histories: [] });

    const { getByTestId } = render(
      <Screen>
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: false, isPrev: true, zIndex: 0 }) }
    );

    const freezeWrapper = getByTestId("content").closest("div[style*='display']");
    expect(freezeWrapper).not.toBeNull();
  });

  // The content wrapper (the flexGrow box that holds {children}) is promoted to
  // its own compositing layer while a transition is in flight, so a mid-transition
  // re-render repaints that layer instead of the transform-animated scope layer
  // (which would stall the transition's presentation on WebKit).
  it("isolates the content onto its own layer while a transition is in flight", () => {
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });
    stores.history.setState({ index: 0, histories: [] });

    const { getByTestId } = render(
      <Screen>
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true }) }
    );

    const contentWrapper = getByTestId("content").parentElement!;
    // Promoted via `transform: translateZ(0)`, NOT `will-change: opacity`: a
    // backdrop-root trigger would wash out a consumer `backdrop-filter` (frosted
    // header) for the duration of the transition, and that breaks on every push
    // of every frosted screen with no consumer-side workaround. A transform is
    // not a backdrop root, so blur keeps rendering.
    expect(contentWrapper.style.transform).toBe("translateZ(0)");
    expect(contentWrapper.style.willChange).toBe("transform");
  });

  it("drops the content layer once the transition settles", () => {
    // beforeEach leaves status COMPLETED.
    stores.history.setState({ index: 0, histories: [] });

    const { getByTestId } = render(
      <Screen>
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true }) }
    );

    const contentWrapper = getByTestId("content").parentElement!;
    expect(contentWrapper.style.transform).toBe("");
    expect(contentWrapper.style.willChange).toBe("");
  });

  // The screen container is fixed to the viewport for a root <Router>, and
  // contained (position: absolute, anchored to its region) under a nested
  // <Router>. The container is the element carrying `contain: layout style`.
  it("anchors the screen container to the viewport by default", () => {
    stores.history.setState({ index: 0, histories: [] });

    const { container } = render(
      <Screen>
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true }) }
    );

    const screenContainer = container.querySelector<HTMLElement>('div[style*="contain"]');
    expect(screenContainer).not.toBeNull();
    expect(screenContainer!.style.position).toBe("fixed");
  });

  it("contains the screen within its region when nested (ScreenViewportContext)", () => {
    stores.history.setState({ index: 0, histories: [] });

    const { container } = render(
      <ScreenViewportContext.Provider value={{ contained: true }}>
        <Screen>
          <div data-testid="content">hello</div>
        </Screen>
      </ScreenViewportContext.Provider>,
      { wrapper: buildHarness({ isActive: true }) }
    );

    const screenContainer = container.querySelector<HTMLElement>('div[style*="contain"]');
    expect(screenContainer).not.toBeNull();
    expect(screenContainer!.style.position).toBe("absolute");
  });

  it("keeps a deeper prev screen frozen once the top has moved more than one entry past it", () => {
    stores.navigate.setState({ status: "POPPING", transitionTaskId: null });
    // index - 2 (1) > zIndex (0) → frozen regardless of replaceTransitionStatus.
    stores.history.setState({ index: 3, histories: [] });

    const { getByTestId } = render(
      <Screen>
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: false, isPrev: true, zIndex: 0 }) }
    );

    const freezeWrapper = getByTestId("content").closest("div[style*='display']");
    expect(freezeWrapper).not.toBeNull();
  });

  const historyEntry = (id: string): History => ({
    id,
    pathname: "/",
    params: {},
    transitionName: "cupertino" as TransitionName,
    layoutId: null
  });

  // The bar's CSS ride rule keys on `data-flemo-bar-riding` AND
  // `data-flemo-bar-status`. Both are rendered onto the same element here, in one
  // commit, so the bar can never carry the transition status without its riding
  // flag for a frame (the late-by-a-frame bug on genuine browser-back).
  it("rides a shared bar in render when the partner screen doesn't own it", () => {
    stores.navigate.setState({ status: "POPPING", transitionTaskId: null });
    stores.history.setState({ index: 1, histories: [historyEntry("below"), historyEntry("top")] });

    const { container } = render(
      <Screen sharedBottomBar={<div>tabs</div>}>
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true, id: "top" }) }
    );

    const bar = container.querySelector('[data-flemo-bar="nav"]')!;
    expect(bar.getAttribute("data-flemo-bar-status")).toBe("POPPING");
    expect(bar.getAttribute("data-flemo-bar-riding")).toBe("true");
  });

  it("does not ride a shared bar the partner screen owns (it hands over instead)", () => {
    stores.navigate.setState({ status: "POPPING", transitionTaskId: null });
    stores.history.setState({ index: 1, histories: [historyEntry("below"), historyEntry("top")] });
    const presence: SharedBarPresence = { topBar: false, bottomBar: true };
    stores.screen.setState({ sharedBars: { below: presence } });

    const { container } = render(
      <Screen sharedBottomBar={<div>tabs</div>}>
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true, id: "top" }) }
    );

    const bar = container.querySelector('[data-flemo-bar="nav"]')!;
    expect(bar.getAttribute("data-flemo-bar-riding")).toBe("false");
  });

  it("renders an entering screen's content immediately when the transition has no initial offset", () => {
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });
    stores.history.setState({ index: 0, histories: [] });

    const { getByTestId } = render(
      <Screen>
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true, transitionName: "none" as TransitionName }) }
    );

    expect(getByTestId("content")).toBeDefined();
  });

  // The compiled hold rule pauses a freshly started transition animation;
  // ScreenMotion renders the flag ON in the same commit as the status attribute
  // and releases it two frames later, anchoring the animation's start to a
  // frame where the entering screen is already painted (iOS otherwise lets the
  // timeline run during the heavy first-frame raster and the opening of the
  // transition is never displayed).
  it("holds a fresh transition animation and releases it two frames later", async () => {
    const frames: FrameRequestCallback[] = [];
    const raf = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((frameCallback) => {
        frames.push(frameCallback);
        return frames.length;
      });
    const caf = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
    try {
      stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });
      stores.history.setState({
        index: 1,
        histories: [historyEntry("below"), historyEntry("top")]
      });

      const { container } = render(
        <Screen sharedBottomBar={<div>tabs</div>}>
          <div>hello</div>
        </Screen>,
        { wrapper: buildHarness({ isActive: true, id: "top" }) }
      );

      const scope = container.querySelector("[data-flemo-screen]")!;
      const bar = container.querySelector('[data-flemo-bar="nav"]')!;
      expect(scope.getAttribute("data-flemo-anim-hold")).toBe("true");
      expect(bar.getAttribute("data-flemo-anim-hold")).toBe("true");

      // First frame: the heavy initial paint. Still held.
      await act(async () => {
        frames.splice(0).forEach((frameCallback) => frameCallback(0));
      });
      expect(scope.getAttribute("data-flemo-anim-hold")).toBe("true");

      // Second frame: released — the animation starts against painted content.
      await act(async () => {
        frames.splice(0).forEach((frameCallback) => frameCallback(16));
      });
      expect(scope.getAttribute("data-flemo-anim-hold")).toBe("false");
      expect(bar.getAttribute("data-flemo-anim-hold")).toBe("false");
    } finally {
      raf.mockRestore();
      caf.mockRestore();
    }
  });

  // The destination park: a COVERED screen (inactive side) upgrades its hold
  // to "park" only when the covering partner registered an opaque surface.
  it("parks a covered held screen when its cover is opaque, pauses otherwise", () => {
    stores.navigate.setState({ status: "POPPING", transitionTaskId: null });
    stores.history.setState({ index: 1, histories: [historyEntry("below"), historyEntry("top")] });
    stores.screen.setState({
      screenSurfaces: { top: { opaqueBackground: true } }
    });

    const { container } = render(
      <Screen>
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: false, isPrev: true, id: "below", zIndex: 0 }) }
    );

    const scope = container.querySelector("[data-flemo-screen]")!;
    expect(scope.getAttribute("data-flemo-anim-hold")).toBe("park");
  });

  it("keeps the paused hold when the cover's surface is unknown or translucent", () => {
    stores.navigate.setState({ status: "POPPING", transitionTaskId: null });
    stores.history.setState({ index: 1, histories: [historyEntry("below"), historyEntry("top")] });
    stores.screen.setState({
      screenSurfaces: { top: { opaqueBackground: false } }
    });

    const { container } = render(
      <Screen>
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: false, isPrev: true, id: "below", zIndex: 0 }) }
    );

    const scope = container.querySelector("[data-flemo-screen]")!;
    expect(scope.getAttribute("data-flemo-anim-hold")).toBe("true");
  });

  it("never parks the active (covering) screen", () => {
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });
    stores.history.setState({ index: 1, histories: [historyEntry("below"), historyEntry("top")] });
    stores.screen.setState({
      screenSurfaces: { below: { opaqueBackground: true } }
    });

    const { container } = render(
      <Screen>
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true, id: "top", zIndex: 1 }) }
    );

    const scope = container.querySelector("[data-flemo-screen]")!;
    expect(scope.getAttribute("data-flemo-anim-hold")).toBe("true");
  });

  it("registers its scope surface opacity for screens beneath to read", () => {
    stores.history.setState({ index: 0, histories: [] });

    render(
      <Screen backgroundColor="rgb(255, 255, 255)">
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true, id: "surface-test" }) }
    );

    expect(stores.screen.getState().screenSurfaces["surface-test"]).toEqual({
      opaqueBackground: true
    });
  });

  it("does not hold a screen at rest", () => {
    stores.history.setState({ index: 0, histories: [] });

    const { container } = render(
      <Screen>
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true }) }
    );

    const scope = container.querySelector("[data-flemo-screen]")!;
    expect(scope.getAttribute("data-flemo-anim-hold")).toBe("false");
  });
});
