import { createElement, useState, type PropsWithChildren, type ReactNode } from "react";

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OVERLAY_LEVEL } from "@flemo/core";
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

afterEach(() => {
  vi.restoreAllMocks();
  // The platform profile reads its overrides straight from sessionStorage, so a
  // flag armed by one case would arm every case after it.
  sessionStorage.clear();
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

  it("stops PAINTING a covered screen in the same commit, not when it is released", () => {
    // The release — effects unmounted, boxes dropped, raster let go — is
    // deferred on purpose, and on a desktop by three seconds. Until it lands
    // the screen was still painting under whatever covered it, and nothing
    // above a screen is obliged to be opaque: that was a stack showing through
    // itself for the whole wait. Paint is the cheap half and does not wait.
    stores.history.setState({ index: 1, histories: [] });

    const { container } = render(
      <Screen>
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: false }) }
    );

    const outer = container.querySelector<HTMLElement>("[data-flemo-screen]")!.parentElement!;
    expect(outer.style.visibility).toBe("hidden");
  });

  it("paints the active screen", () => {
    const { container } = render(
      <Screen>
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true }) }
    );

    const outer = container.querySelector<HTMLElement>("[data-flemo-screen]")!.parentElement!;
    expect(outer.style.visibility).toBe("");
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

  // The content wrapper must NOT be promoted or transformed: the old
  // translateZ(0) isolation (#117 → #127) targeted a WebKit stall whose real
  // cause was the animation-start anchoring (fixed via data-flemo-anim-hold),
  // and the transform made this box a containing block that trapped consumer
  // `position: fixed` overlays (the reason <Layer> had to exist).
  it("keeps the content wrapper transform-free during a transition (no containing block)", () => {
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });
    stores.history.setState({ index: 0, histories: [] });

    // The content wrapper is a shell element (rendered in the first commit even
    // while shell-first defers the consumer children), so query it directly.
    const { container } = render(
      <Screen>
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true }) }
    );

    const contentWrapper = container.querySelector<HTMLElement>('div[style*="flex-grow: 1"]')!;
    expect(contentWrapper.style.transform).toBe("");
    expect(contentWrapper.style.willChange).toBe("");
  });

  // The screen container is fixed to the viewport for a root <Router>, and
  // contained (position: absolute, anchored to its region) under a nested
  // <Router>. Style containment must not become layout containment because
  // that traps fixed consumer overlays below surrounding shared bars.
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
    expect(screenContainer!.style.contain).toBe("style");
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
    expect(screenContainer!.style.contain).toBe("style");
  });

  // The pair that keeps a screen's stacking to itself without becoming the
  // containing block for a consumer's `position: fixed` overlay. Layout
  // containment would give both and traps bottom sheets in a nested Slot;
  // `isolation` alone leaves the overlay anchored to the viewport, and the
  // container's own number is what carries it over the surrounding bars.
  it("isolates a screen's stacking and numbers it by stack position", () => {
    stores.history.setState({ index: 0, histories: [] });

    const { container } = render(
      <Screen>
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true }) }
    );

    const screenContainer = container.querySelector<HTMLElement>('div[style*="contain"]');
    expect(screenContainer!.style.isolation).toBe("isolate");
    expect(screenContainer!.style.zIndex).toBe("1");
  });

  // flemo's own chrome stays UNNUMBERED, and that is the assertion. Giving the
  // bars and the dim explicit levels reads as tidier and demotes whatever
  // consumer content used to outrank them at `auto` — measured in a consumer
  // app as a bottom sheet that stopped covering the tab bar. Only the <Layer>
  // host bids, because it has to clear the screens inside the scope it left.
  it("numbers its overlay host and nothing else", () => {
    stores.history.setState({ index: 0, histories: [] });
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });

    const { container } = render(
      <Screen sharedBottomBar={<nav data-testid="bar" />} sharedBottomBarId="bar">
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: false }) }
    );

    const bar = container.querySelector<HTMLElement>('[data-flemo-bar="nav"]');
    const host = container.querySelector<HTMLElement>("[data-flemo-layer-host]");
    const decorator = container.querySelector<HTMLElement>("[data-flemo-decorator]");

    expect(bar).not.toBeNull();
    expect(host).not.toBeNull();
    expect(bar!.style.zIndex).toBe("");
    if (decorator) expect(decorator.style.zIndex).toBe("");
    expect(Number(host!.style.zIndex)).toBe(OVERLAY_LEVEL);
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
    transitionName: "cupertino" as TransitionName
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

  it("hands over same-ID bars while different-ID bars ride with their screen", () => {
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });
    stores.history.setState({ index: 1, histories: [historyEntry("below"), historyEntry("top")] });
    stores.screen.setState({
      sharedBars: { below: { topBar: true, bottomBar: true } },
      sharedBarMetadata: {
        below: {
          topBar: { id: "pattern-builder-header", height: 106 },
          bottomBar: { id: "main-tabs", height: 64 }
        }
      }
    });

    const { container } = render(
      <Screen
        sharedTopBar={<div>builder</div>}
        sharedTopBarId="pattern-builder-header"
        sharedBottomBar={<div>next</div>}
        sharedBottomBarId="pattern-builder-actions"
      >
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true, id: "top" }) }
    );

    expect(
      container.querySelector('[data-flemo-bar="app"]')!.getAttribute("data-flemo-bar-riding")
    ).toBe("false");
    expect(
      container.querySelector('[data-flemo-bar="nav"]')!.getAttribute("data-flemo-bar-riding")
    ).toBe("true");
  });

  it("seeds both spacers from matching partner measurements on the first render", () => {
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });
    stores.history.setState({ index: 1, histories: [historyEntry("below"), historyEntry("top")] });
    stores.screen.setState({
      sharedBars: { below: { topBar: true, bottomBar: true } },
      sharedBarMetadata: {
        below: {
          topBar: { id: "pattern-builder-header", height: 106 },
          bottomBar: { id: "pattern-builder-actions", height: 81 }
        }
      }
    });

    const { container } = render(
      <Screen
        sharedTopBar={<div>builder</div>}
        sharedTopBarId="pattern-builder-header"
        sharedBottomBar={<div>next</div>}
        sharedBottomBarId="pattern-builder-actions"
      >
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true, id: "top" }) }
    );

    expect(
      container.querySelector<HTMLElement>('[data-flemo-bar-spacer="app"]')!.style.minHeight
    ).toBe("106px");
    expect(
      container.querySelector<HTMLElement>('[data-flemo-bar-spacer="nav"]')!.style.minHeight
    ).toBe("81px");
  });

  it("does not seed a spacer from a different bar ID", () => {
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });
    stores.history.setState({ index: 1, histories: [historyEntry("below"), historyEntry("top")] });
    stores.screen.setState({
      sharedBars: { below: { topBar: false, bottomBar: true } },
      sharedBarMetadata: { below: { bottomBar: { id: "main-tabs", height: 64 } } }
    });

    const { container } = render(
      <Screen sharedBottomBar={<div>next</div>} sharedBottomBarId="pattern-builder-actions">
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true, id: "top" }) }
    );

    expect(
      container.querySelector<HTMLElement>('[data-flemo-bar-spacer="nav"]')!.style.minHeight
    ).toBe("0px");
  });

  it("synchronously reserves a newly mounted bar's measured height", () => {
    stores.history.setState({ index: 0, histories: [historyEntry("top")] });
    const metadataWrites: unknown[] = [];
    let previousMetadata = stores.screen.getState().sharedBarMetadata.top;
    const unsubscribe = stores.screen.subscribe((state) => {
      const nextMetadata = state.sharedBarMetadata.top;
      if (nextMetadata !== previousMetadata) {
        previousMetadata = nextMetadata;
        if (nextMetadata) metadataWrites.push(nextMetadata);
      }
    });
    const offsetHeight = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockImplementation(function (this: HTMLElement) {
        if (this.dataset.flemoBar === "app") return 106;
        if (this.dataset.flemoBar === "nav") return 81;
        return 0;
      });

    const { container } = render(
      <Screen
        sharedTopBar={<div>builder</div>}
        sharedTopBarId="pattern-builder-header"
        sharedBottomBar={<div>next</div>}
        sharedBottomBarId="pattern-builder-actions"
      >
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true, id: "top" }) }
    );

    expect(
      container.querySelector<HTMLElement>('[data-flemo-bar-spacer="app"]')!.style.minHeight
    ).toBe("106px");
    expect(
      container.querySelector<HTMLElement>('[data-flemo-bar-spacer="nav"]')!.style.minHeight
    ).toBe("81px");
    expect(stores.screen.getState().sharedBarMetadata.top).toEqual({
      topBar: { id: "pattern-builder-header", height: 106 },
      bottomBar: { id: "pattern-builder-actions", height: 81 }
    });
    // Ref attachment precedes layout effects. Registration must consume that
    // measurement so subscribers never observe an identity-only entry followed
    // by a second height update in the same commit.
    expect(metadataWrites).toEqual([
      {
        topBar: { id: "pattern-builder-header", height: 106 },
        bottomBar: { id: "pattern-builder-actions", height: 81 }
      }
    ]);
    unsubscribe();
    offsetHeight.mockRestore();
  });

  it("keeps the spacer and metadata current when ResizeObserver reports a dynamic resize", () => {
    stores.history.setState({ index: 0, histories: [historyEntry("top")] });
    const OriginalResizeObserver = globalThis.ResizeObserver;
    // A screen with a shared bar runs more than one observer: the bar's height
    // and the screen's own box (publishRideBox). Route the entry to the one
    // that actually observed the bar, so this test keeps measuring the spacer
    // and not whichever observer happened to be constructed last.
    const callbacks = new Map<string | undefined, ResizeObserverCallback>();
    globalThis.ResizeObserver = class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(element: HTMLElement) {
        callbacks.set(element.dataset.flemoBar, this.callback);
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    try {
      const { container } = render(
        <Screen sharedBottomBar={<div>next</div>} sharedBottomBarId="pattern-builder-actions">
          <div>hello</div>
        </Screen>,
        { wrapper: buildHarness({ isActive: true, id: "top" }) }
      );

      act(() => {
        callbacks.get("nav")?.(
          [{ contentRect: { height: 93 } } as ResizeObserverEntry],
          undefined as unknown as ResizeObserver
        );
      });

      expect(
        container.querySelector<HTMLElement>('[data-flemo-bar-spacer="nav"]')!.style.minHeight
      ).toBe("93px");
      expect(stores.screen.getState().sharedBarMetadata.top?.bottomBar).toEqual({
        id: "pattern-builder-actions",
        height: 93
      });
    } finally {
      globalThis.ResizeObserver = OriginalResizeObserver;
    }
  });

  it("keeps a bar's resize observation across consumer re-renders", () => {
    // The observed element is flemo's OWN wrapper, not the node the consumer
    // handed over, and that wrapper survives for as long as the screen has a
    // bar at all. So the observation must be keyed on whether a bar EXISTS,
    // never on the node's identity: `sharedBottomBar={<TabBar />}` is a fresh
    // element on every consumer render, and keying on it re-ran a layout
    // effect that disconnects the observer, reads offsetHeight (a forced
    // layout) and re-observes, all in the pre-paint window, once per consumer
    // render. A screen that re-renders during a flight paid that on the frames
    // the motion is watched.
    stores.history.setState({ index: 0, histories: [historyEntry("top")] });
    const OriginalResizeObserver = globalThis.ResizeObserver;
    const observed: (string | undefined)[] = [];
    let disconnects = 0;
    globalThis.ResizeObserver = class {
      observe(element: HTMLElement) {
        // Bar observations only. The screen also observes its OWN box to
        // publish the ride distance, and that one is keyed on bar PRESENCE
        // too, so counting it here would just restate the same guard twice.
        if (element.dataset.flemoBar) observed.push(element.dataset.flemoBar);
      }
      unobserve() {}
      disconnect() {
        disconnects += 1;
      }
    } as unknown as typeof ResizeObserver;

    try {
      let rerenderConsumer!: () => void;
      function Consumer() {
        const [, setTick] = useState(0);
        rerenderConsumer = () => setTick((tick) => tick + 1);
        return (
          <Screen sharedBottomBar={<div>next</div>} sharedBottomBarId="pattern-builder-actions">
            <div>hello</div>
          </Screen>
        );
      }

      render(<Consumer />, { wrapper: buildHarness({ isActive: true, id: "top" }) });
      expect(observed).toEqual(["nav"]);

      act(() => rerenderConsumer());

      expect(observed).toEqual(["nav"]);
      expect(disconnects).toBe(0);
    } finally {
      globalThis.ResizeObserver = OriginalResizeObserver;
    }
  });

  it("mounts an entering screen's content in its FIRST commit (no shell-first deferral)", () => {
    // Regression guard for the reverted shell-first experiment: deferring
    // children unconditionally made every light screen enter as a blank shell
    // with its content popping in after the transition started (flicker /
    // perceived double render on real apps). Children must be present in the
    // very first commit; the anim-hold anchors the motion to their paint, and
    // a heavy commit delays the start instead of losing the window (the task
    // gate re-arms while held — see TaskManger.markGateHeld / anchorGate).
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });
    stores.history.setState({ index: 0, histories: [] });

    const { queryByTestId } = render(
      <Screen>
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true, transitionName: "none" as TransitionName }) }
    );

    expect(queryByTestId("content")).not.toBeNull();
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
          {/* Content-RICH body: this test exercises the two-frame paint
              anchor alone. A near-empty body now reads as a SHELL (deferred
              skeletons) and the enter settle gate would hold past the grace,
              which is the settle suite's subject, not this one's. */}
          <div>
            이 화면은 충분한 본문 텍스트를 이미 갖춘 따뜻한 화면입니다. 게이트는 콘텐츠 밀도로 쉘을
            판정하므로 이 문단이 그 판정을 통과시킵니다.
          </div>
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

  it("parks the active entering screen UNDER an opaque previous screen (push pre-raster)", () => {
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
    expect(scope.getAttribute("data-flemo-anim-hold")).toBe("park-under");
  });

  it("marks a park-over for the head that follows it, and keeps the mark past the release", () => {
    // The parked head is the compiled sheet's half of the same decision; it has
    // to still be matching while the head runs, long after the hold reads
    // RELEASED, or the release drops the screen off-screen and WebKit throws the
    // raster the park just paid for away.
    sessionStorage.setItem("flemo:preraster", "on");
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });
    stores.history.setState({ index: 1, histories: [historyEntry("below"), historyEntry("top")] });
    stores.screen.setState({ screenSurfaces: { below: { opaqueBackground: true } } });

    const { container } = render(
      <Screen>
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true, id: "top", zIndex: 1 }) }
    );

    const scope = container.querySelector("[data-flemo-screen]")!;
    expect(scope.getAttribute("data-flemo-anim-hold")).toBe("park-over");
    expect(scope.getAttribute("data-flemo-park-head")).toBe("true");

    act(() => {
      stores.screen.setState({ screenSurfaces: { below: { opaqueBackground: false } } });
    });
    // The surface re-reading translucent mid-flight must not un-mark it: the
    // screen is already parked and the head is what carries it home.
    expect(scope.getAttribute("data-flemo-park-head")).toBe("true");
  });

  it("leaves the mark off a screen that only ever parked under its cover", () => {
    // park-under keeps the layer occluded, which is the reason WebKit never
    // rastered it — there is no raster for a parked head to protect.
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });
    stores.history.setState({ index: 1, histories: [historyEntry("below"), historyEntry("top")] });
    stores.screen.setState({ screenSurfaces: { below: { opaqueBackground: true } } });

    const { container } = render(
      <Screen>
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true, id: "top", zIndex: 1 }) }
    );

    const scope = container.querySelector("[data-flemo-screen]")!;
    expect(scope.getAttribute("data-flemo-anim-hold")).toBe("park-under");
    expect(scope.getAttribute("data-flemo-park-head")).toBe(null);
  });

  it("never park-unders the leaving top on POP (it would expose the returning screen)", () => {
    stores.navigate.setState({ status: "POPPING", transitionTaskId: null });
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

  it("keeps the paused hold for the active screen when the previous surface is unknown", () => {
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });
    stores.history.setState({ index: 1, histories: [historyEntry("below"), historyEntry("top")] });

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

describe("Screen freeze deferral", () => {
  const frozenWrapperOf = (getByTestId: (id: string) => HTMLElement) =>
    getByTestId("content").closest("div[style*='display: none']");

  it("defers a live freeze flip past the convergence, then applies it", () => {
    vi.useFakeTimers();
    try {
      stores.history.setState({ index: 0, histories: [] });
      stores.navigate.setState({ status: "PUSHING", transitionTaskId: "t1" });

      // Covered side of a push: becomes freezable only when the status settles.
      const { getByTestId } = render(
        <Screen>
          <div data-testid="content">covered</div>
        </Screen>,
        { wrapper: buildHarness({ isActive: false, isPrev: false, zIndex: 0 }) }
      );
      expect(frozenWrapperOf(getByTestId)).toBeNull();

      act(() => {
        stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
      });
      // The convergence frames stay freeze-free...
      expect(frozenWrapperOf(getByTestId)).toBeNull();
      act(() => {
        vi.advanceTimersByTime(599);
      });
      expect(frozenWrapperOf(getByTestId)).toBeNull();
      // ...and the commit lands in the quiet window after.
      act(() => {
        vi.advanceTimersByTime(2);
      });
      expect(frozenWrapperOf(getByTestId)).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a new transition inside the defer window re-arms the freeze timer", () => {
    vi.useFakeTimers();
    try {
      stores.history.setState({ index: 0, histories: [] });
      stores.navigate.setState({ status: "PUSHING", transitionTaskId: "t1" });
      const { getByTestId } = render(
        <Screen>
          <div data-testid="content">covered</div>
        </Screen>,
        { wrapper: buildHarness({ isActive: false, isPrev: false, zIndex: 0 }) }
      );

      act(() => {
        stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
      });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      // A navigation starts before the freeze lands: the pending commit must
      // not punch into the new flight.
      act(() => {
        stores.navigate.setState({ status: "PUSHING", transitionTaskId: "t2" });
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(frozenWrapperOf(getByTestId)).toBeNull();
      // It lands one quiet window after the new flight settles.
      act(() => {
        stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
      });
      act(() => {
        vi.advanceTimersByTime(601);
      });
      expect(frozenWrapperOf(getByTestId)).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("unfreezes immediately when the screen becomes the pop destination", () => {
    vi.useFakeTimers();
    try {
      stores.history.setState({ index: 0, histories: [] });
      stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
      const { getByTestId, rerender } = render(
        <Screen>
          <div data-testid="content">covered</div>
        </Screen>,
        { wrapper: buildHarness({ isActive: false, isPrev: false, zIndex: 0 }) }
      );
      // Mounted already-covered: frozen from the first commit, no deferral.
      expect(frozenWrapperOf(getByTestId)).not.toBeNull();

      // A pop starts: the destination must wake in the same commit.
      act(() => {
        stores.navigate.setState({ status: "POPPING", transitionTaskId: "t3" });
      });
      rerender(
        <Screen>
          <div data-testid="content">covered</div>
        </Screen>
      );
      expect(frozenWrapperOf(getByTestId)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Screen freeze deferral during a live transition", () => {
  it("a screen that becomes DEEP mid-push freezes in that very commit", () => {
    vi.useFakeTimers();
    try {
      stores.history.setState({ index: 1, histories: [] });
      stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });

      // A wrapper whose context VALUE is swappable without changing the tree,
      // so role flips re-render the same Screen instance instead of
      // remounting it (a remount freezes from its initial state and skips
      // the deferral under test).
      let screenValue: ScreenContextProps = {
        id: "screen-live",
        isActive: true,
        isRoot: false,
        isPrev: false,
        zIndex: 1,
        pathname: "/live",
        params: {},
        transitionName: "cupertino" as TransitionName,
        prevTransitionName: "cupertino" as TransitionName,
        routePath: "/live"
      };
      function LiveHarness({ children }: PropsWithChildren): ReactNode {
        return createElement(
          StoreContext.Provider,
          { value: stores },
          createElement(ScreenContext.Provider, { value: screenValue }, children)
        );
      }

      const { getByTestId, rerender } = render(
        <Screen>
          <div data-testid="content">page</div>
        </Screen>,
        { wrapper: LiveHarness }
      );
      const frozenWrapper = () => getByTestId("content").closest("div[style*='display: none']");
      expect(frozenWrapper()).toBeNull();

      // A push starts and this screen sinks BELOW the covered prev (isPrev
      // per the selector = deeper than the direct prev): it was already
      // covered before this transition began, so its freeze must land in
      // this very commit — deferring deep freezes is what let a rapid push
      // storm accumulate 15-20 live full-screen layers (no quiet window ever
      // arrived to run the deferral).
      screenValue = { ...screenValue, isActive: false, isPrev: true };
      act(() => {
        stores.history.setState({ index: 2, histories: [] });
        stores.navigate.setState({ status: "PUSHING", transitionTaskId: "t-next" });
      });
      rerender(
        <Screen>
          <div data-testid="content">page</div>
        </Screen>
      );
      expect(frozenWrapper()).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
