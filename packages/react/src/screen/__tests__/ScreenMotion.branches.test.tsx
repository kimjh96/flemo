import { createElement, type PropsWithChildren, type ReactNode } from "react";

import { act, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TransitionName } from "@flemo/core";

import Screen from "@screen/Screen";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";
import useViewportScrollHeight from "@screen/useViewportScrollHeight";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

let stores: FlemoStores;

beforeEach(() => {
  stores = createTestStores();
  stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
  stores.history.setState({ index: 0, histories: [] });
});

function buildHarness(overrides: Partial<ScreenContextProps> = {}) {
  const screen: ScreenContextProps = {
    id: "screen-1",
    isActive: true,
    isRoot: true,
    isPrev: false,
    zIndex: 0,
    pathname: "/",
    params: {},
    transitionName: "cupertino" as TransitionName,
    prevTransitionName: "cupertino" as TransitionName,
    layoutId: null,
    routePath: "/",
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

describe("ScreenMotion chrome rendering", () => {
  it("reserves status-bar and system-navigation space with the configured colors", () => {
    const { container } = render(
      <Screen
        statusBarHeight="20px"
        statusBarColor="red"
        systemNavigationBarHeight="10px"
        systemNavigationBarColor="blue"
      >
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness() }
    );

    const statusBar = container.querySelector<HTMLElement>('div[style*="min-height: 20px"]');
    expect(statusBar).not.toBeNull();
    const systemBar = container.querySelector<HTMLElement>('div[style*="min-height: 10px"]');
    expect(systemBar).not.toBeNull();
  });

  it("hides the chrome when hideStatusBar / hideSystemNavigationBar are set", () => {
    const { container } = render(
      <Screen
        statusBarHeight="20px"
        systemNavigationBarHeight="10px"
        hideStatusBar
        hideSystemNavigationBar
      >
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness() }
    );

    expect(container.querySelector('div[style*="min-height: 20px"]')).toBeNull();
    expect(container.querySelector('div[style*="min-height: 10px"]')).toBeNull();
  });

  it("renders top/bottom bars and a decorator for a decorated transition", () => {
    const { getByTestId, container } = render(
      <Screen
        topBar={<div data-testid="top">top</div>}
        bottomBar={<div data-testid="bottom">bottom</div>}
      >
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness() }
    );

    expect(getByTestId("top")).toBeDefined();
    expect(getByTestId("bottom")).toBeDefined();
    // cupertino declares the overlay decorator.
    expect(container.querySelector("[data-flemo-decorator]")).not.toBeNull();
  });

  it("turns off content scrolling when contentScrollable is false", () => {
    const { getByTestId } = render(
      <Screen contentScrollable={false}>
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness() }
    );

    const contentWrapper = getByTestId("content").parentElement!;
    expect(contentWrapper.style.overflowY).toBe("");
  });

  it("wires the scope's pointer handlers to the swipe controller", () => {
    const { container } = render(
      <Screen>
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness() }
    );

    const scope = container.querySelector<HTMLElement>("[data-flemo-screen]")!;
    // At rest on a root screen the controller's readiness gate is closed, so
    // the handlers run and return without starting a drag.
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
      scope.dispatchEvent(new Event(type, { bubbles: true }));
    }
    expect(scope.getAttribute("data-flemo-status")).toBe("COMPLETED");
  });

  it("prevents touch scrolling that starts on a swipe edge bar", () => {
    const { container } = render(
      <Screen>
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness() }
    );

    const edge = container.querySelector<HTMLElement>("[data-swipe-at-edge-bar]")!;
    const scope = container.querySelector<HTMLElement>("[data-flemo-screen]")!;
    scope.appendChild(edge); // ensure the listener's scope contains the target
    const touchMove = new Event("touchmove", { bubbles: true, cancelable: true });
    edge.dispatchEvent(touchMove);

    expect(touchMove.defaultPrevented).toBe(true);
  });
});

describe("keyboard-visible layout", () => {
  let listeners: Map<string, EventListener>;
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    listeners = new Map();
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (frameCallback: FrameRequestCallback) => {
      frames.push(frameCallback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        height: 500, // 300px short of the 800px document → keyboard open
        addEventListener: (type: string, listener: EventListener) => {
          listeners.set(type, listener);
        },
        removeEventListener: (type: string) => {
          listeners.delete(type);
        }
      }
    });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 800
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports the viewport shortfall through useViewportScrollHeight", async () => {
    const { result } = renderHook(() => useViewportScrollHeight());

    await act(async () => {
      listeners.get("resize")?.(new Event("resize"));
      frames.splice(0).forEach((frameCallback) => frameCallback(0));
    });

    expect(result.current.viewportScrollHeight).toBe(300);
  });

  it("hides the shared bottom bar and system navigation while the keyboard is open", async () => {
    const { container } = render(
      <Screen sharedBottomBar={<div>tabs</div>} systemNavigationBarHeight="10px">
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness() }
    );

    await act(async () => {
      listeners.get("resize")?.(new Event("resize"));
      frames.splice(0).forEach((frameCallback) => frameCallback(0));
    });

    const bar = container.querySelector<HTMLElement>('[data-flemo-bar="nav"]')!;
    expect(bar.style.display).toBe("none");
  });
});
