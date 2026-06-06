import { createElement, type PropsWithChildren, type ReactNode } from "react";

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { TransitionName } from "@flemo/core";

import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";
import ScreenDecorator from "@screen/ScreenDecorator";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// ScreenDecorator reads the active transition from ScreenContext and the navigation status from
// the request-scoped navigate store. Provide both with a thin harness; the transition presets are
// registered when @flemo/core is imported, so `cupertino` resolves to its `overlay` decorator.

let stores: FlemoStores;

beforeEach(() => {
  stores = createTestStores();
});

function buildHarness(transitionName: TransitionName) {
  const screen: ScreenContextProps = {
    id: "screen-1",
    isActive: true,
    isRoot: false,
    isPrev: false,
    zIndex: 0,
    pathname: "/posts/1",
    params: { id: "1" },
    transitionName,
    prevTransitionName: transitionName,
    layoutId: null,
    routePath: "/posts/:id"
  };

  return function Harness({ children }: PropsWithChildren): ReactNode {
    return createElement(
      StoreContext.Provider,
      { value: stores },
      createElement(ScreenContext.Provider, { value: screen }, children)
    );
  };
}

describe("ScreenDecorator", () => {
  it("renders the decorator element for a transition that declares one", () => {
    stores.navigate.setState({ status: "POPPING", transitionTaskId: null });

    const { container } = render(<ScreenDecorator />, { wrapper: buildHarness("cupertino") });

    const decorator = container.querySelector("[data-flemo-decorator]");
    expect(decorator).not.toBeNull();
    expect(decorator?.getAttribute("data-flemo-decorator-name")).toBe("overlay");
    // Status + active flags mirror the navigate store and ScreenContext.
    expect(decorator?.getAttribute("data-flemo-status")).toBe("POPPING");
    expect(decorator?.getAttribute("data-flemo-active")).toBe("true");
  });

  it("renders nothing when the resolved transition has no decorator", () => {
    const { container } = render(<ScreenDecorator />, { wrapper: buildHarness("none") });

    expect(container.querySelector("[data-flemo-decorator]")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("falls back to the `none` transition for an unregistered name, so no decorator renders", () => {
    // An unknown name misses transitionMap, exercising the `?? transitionMap.get("none")`
    // fallback; `none` declares no decorator, so the component renders nothing.
    const { container } = render(<ScreenDecorator />, {
      wrapper: buildHarness("__unregistered__" as TransitionName)
    });

    expect(container.querySelector("[data-flemo-decorator]")).toBeNull();
    expect(container.firstChild).toBeNull();
  });
});
