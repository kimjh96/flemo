import { createElement, type PropsWithChildren, type ReactNode } from "react";

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SwipeControllerConfig, TransitionName } from "@flemo/core";

import Screen from "@screen/Screen";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// WHOSE BACK A SWIPE COMMITS.
//
// The gesture's commit was `window.history.back()`, written straight into the
// binding. For a browser Router that is the same call the driver makes; for a
// MEMORY Router it is a different history entirely — the page's — so a
// swipe-back inside a memory stack walked the whole document backwards instead
// of popping the stack the finger was dragging. The commit belongs to the
// Router that owns the screen.

const captured: { config: SwipeControllerConfig | null } = { config: null };

vi.mock("@flemo/core", async () => {
  const actual = await vi.importActual<typeof import("@flemo/core")>("@flemo/core");
  return {
    ...actual,
    createSwipeController: (config: SwipeControllerConfig) => {
      captured.config = config;
      return {
        pointerDown: () => {},
        pointerMove: () => {},
        pointerUp: () => {},
        pointerCancel: () => {},
        lostPointerCapture: () => {},
        abandon: () => {},
        shouldPreventTouch: () => false
      };
    }
  };
});

let stores: FlemoStores;

beforeEach(() => {
  stores = createTestStores();
  stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
  stores.history.setState({ index: 0, histories: [] });
  captured.config = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function buildHarness(): (props: PropsWithChildren) => ReactNode {
  const screen: ScreenContextProps = {
    id: "screen-2",
    isActive: true,
    isRoot: false,
    isPrev: false,
    zIndex: 1,
    pathname: "/detail",
    params: {},
    transitionName: "cupertino" as TransitionName,
    prevTransitionName: "cupertino" as TransitionName,
    routePath: "/detail"
  };
  return function Harness({ children }: PropsWithChildren): ReactNode {
    return createElement(
      StoreContext.Provider,
      { value: stores },
      createElement(ScreenContext.Provider, { value: screen }, children)
    );
  };
}

describe("ScreenMotion swipe commit", () => {
  it("pops the Router that owns the screen, not the page around it", () => {
    const Harness = buildHarness();
    const driverBack = vi.spyOn(stores.driver, "back").mockImplementation(() => {});
    const pageBack = vi.spyOn(window.history, "back").mockImplementation(() => {});

    render(createElement(Harness, null, createElement(Screen, null, "detail")));

    expect(captured.config).not.toBeNull();
    captured.config!.back();

    expect(driverBack).toHaveBeenCalledTimes(1);
    expect(pageBack).not.toHaveBeenCalled();
  });
});
