import { createElement, type PropsWithChildren, type ReactNode } from "react";

import { act, fireEvent, render, renderHook } from "@testing-library/react";
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

  it("suppresses click activation during push while leaving the screen hit-testable", () => {
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: "push-1" });
    const onClick = vi.fn();
    const { getByRole, container } = render(
      <Screen>
        <button onClick={onClick}>Open</button>
      </Screen>,
      { wrapper: buildHarness({ isRoot: false }) }
    );

    const scope = container.querySelector<HTMLElement>("[data-flemo-screen]")!;
    const button = getByRole("button");
    const onNativeClick = vi.fn();
    button.addEventListener("click", onNativeClick);
    expect(scope.style.pointerEvents).toBe("");
    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
    expect(onNativeClick).not.toHaveBeenCalled();
  });
});

describe("swipe wiring on a swipeable (non-root) screen", () => {
  it("a left-edge drag flows through the controller's element accessors and blocks native touch scroll", async () => {
    const { container } = render(
      <Screen sharedTopBar={<div data-testid="shared-top">top</div>}>
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness({ isRoot: false }) }
    );

    const scope = container.querySelector<HTMLElement>("[data-flemo-screen]")!;
    // jsdom has no pointer capture; the controller calls all three.
    scope.setPointerCapture = vi.fn();
    scope.hasPointerCapture = vi.fn(() => true);
    scope.releasePointerCapture = vi.fn();

    // beginSwipe resolves the screen below via the previous-sibling walk, so
    // every ancestor between the scope and the render root needs a preceding
    // sibling carrying a screen — plant one before the outermost.
    const outermost = container.firstElementChild as HTMLElement;
    const prevContainer = document.createElement("div");
    const prevScope = document.createElement("div");
    prevScope.setAttribute("data-flemo-screen", "");
    prevContainer.appendChild(prevScope);
    outermost.before(prevContainer);

    // An edge press, then a rightward move: the readiness gate (non-root,
    // active, COMPLETED, cupertino's x swipe) opens and the drag begins,
    // pulling every element accessor handed to the controller.
    scope.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 4, clientY: 300 }));
    scope.dispatchEvent(
      new MouseEvent("pointermove", { bubbles: true, clientX: 40, clientY: 300 })
    );
    await act(async () => {
      await Promise.resolve();
    });

    // The in-progress drag owns the gesture: native touch scrolling yields.
    const touchMove = new Event("touchmove", { bubbles: true, cancelable: true });
    scope.dispatchEvent(touchMove);
    expect(touchMove.defaultPrevented).toBe(true);

    // Release back to rest so no drag state leaks into the next test.
    scope.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 40, clientY: 300 }));
    await act(async () => {
      await Promise.resolve();
    });
  });

  // THE DEAD SCROLL, end to end through the binding.
  //
  // An armed drag preventDefaults every touchmove on the screen — that is the
  // whole point while a finger owns the gesture, and it is the only thing in
  // the library that can stop a screen from scrolling. So if the pointer's
  // closing event never arrives, the screen stops scrolling for good.
  // Device-reported on Safari, which drops the remaining pointer events when
  // the element holding capture is removed or hidden.
  const armStrandedDrag = async (container: HTMLElement) => {
    const scope = container.querySelector<HTMLElement>("[data-flemo-screen]")!;
    scope.setPointerCapture = vi.fn();
    scope.hasPointerCapture = vi.fn(() => true);
    scope.releasePointerCapture = vi.fn();

    const outermost = container.firstElementChild as HTMLElement;
    const prevContainer = document.createElement("div");
    const prevScope = document.createElement("div");
    prevScope.setAttribute("data-flemo-screen", "");
    prevContainer.appendChild(prevScope);
    outermost.before(prevContainer);

    scope.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 4, clientY: 300 }));
    scope.dispatchEvent(
      new MouseEvent("pointermove", { bubbles: true, clientX: 40, clientY: 300 })
    );
    await act(async () => {
      await Promise.resolve();
    });

    // No pointerup and no pointercancel — the browser simply stopped talking.
    return scope;
  };

  const scrolls = (scope: HTMLElement) => {
    const touchMove = new Event("touchmove", { bubbles: true, cancelable: true });
    scope.dispatchEvent(touchMove);
    return !touchMove.defaultPrevented;
  };

  it("gives the scroll back when capture is lost without a pointerup", async () => {
    const { container } = render(
      <Screen>
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness({ isRoot: false }) }
    );

    const scope = await armStrandedDrag(container);
    expect(scrolls(scope), "the drag must actually own the gesture first").toBe(false);

    scope.dispatchEvent(new Event("lostpointercapture", { bubbles: true }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(scrolls(scope)).toBe(true);
  });

  it("gives the scroll back on the next press, however the pointer vanished", async () => {
    const { container } = render(
      <Screen>
        <div>hello</div>
      </Screen>,
      { wrapper: buildHarness({ isRoot: false }) }
    );

    const scope = await armStrandedDrag(container);
    expect(scrolls(scope)).toBe(false);

    // A fresh press — a different pointer, because the first was never closed.
    scope.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, clientX: 200, clientY: 300 })
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(scrolls(scope)).toBe(true);
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
