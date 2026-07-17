import { createElement, type PropsWithChildren, type ReactNode } from "react";

import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import Part from "@screen/Part";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// Part mirrors the screen's status (navigate store) and active flag
// (ScreenContext) onto its wrapper so the compiled bar-transition keyframes
// match the right variant. Drive both with a thin harness.

let stores: FlemoStores;

beforeEach(() => {
  stores = createTestStores();
});

function buildHarness(isActive: boolean) {
  const screen: ScreenContextProps = {
    id: "screen-1",
    isActive,
    isRoot: false,
    isPrev: false,
    zIndex: 0,
    pathname: "/album/1",
    params: { id: "1" },
    transitionName: "cupertino",
    prevTransitionName: "cupertino",
    layoutId: null,
    routePath: "/album/:id"
  };

  return function Harness({ children }: PropsWithChildren): ReactNode {
    return createElement(
      StoreContext.Provider,
      { value: stores },
      createElement(ScreenContext.Provider, { value: screen }, children)
    );
  };
}

describe("Part", () => {
  it("renders its child inside a wrapper carrying name + mirrored status/active", () => {
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });

    const { container, getByText } = render(
      <Part name="title-fade">
        <span>Album Title</span>
      </Part>,
      { wrapper: buildHarness(true) }
    );

    const el = container.querySelector('[data-flemo-part-name="title-fade"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute("data-flemo-status")).toBe("PUSHING");
    expect(el?.getAttribute("data-flemo-active")).toBe("true");
    expect(getByText("Album Title")).toBeTruthy();
  });

  it("reports active=false for the previous (inactive) screen's bar", () => {
    stores.navigate.setState({ status: "POPPING", transitionTaskId: null });

    const { container } = render(<Part name="title-fade">x</Part>, {
      wrapper: buildHarness(false)
    });

    const el = container.querySelector('[data-flemo-part-name="title-fade"]');
    expect(el?.getAttribute("data-flemo-active")).toBe("false");
    expect(el?.getAttribute("data-flemo-status")).toBe("POPPING");
  });

  // Nested-Router chrome: a Part in the OUTER screen's content can sit under an
  // inner Router's StoreContext. The screen context carries the owning scope's
  // navigate store, and the Part must follow THAT status (the outer transition),
  // not the nearest bundle's, reactively.
  it("follows the owning screen's navigate store over the nearest bundle", () => {
    const owningStores = createTestStores();
    owningStores.navigate.setState({ status: "PUSHING", transitionTaskId: null });
    // The nearest (inner Router) bundle idles; it must not win.
    stores.navigate.setState({ status: "IDLE", transitionTaskId: null });

    const screen: ScreenContextProps = {
      id: "outer-screen",
      isActive: false,
      isRoot: false,
      isPrev: true,
      zIndex: 0,
      pathname: "/playground/1",
      params: {},
      transitionName: "cupertino",
      prevTransitionName: "cupertino",
      layoutId: null,
      routePath: "/playground/:n",
      navigateStore: owningStores.navigate
    };

    const { container } = render(
      createElement(
        StoreContext.Provider,
        { value: stores },
        createElement(ScreenContext.Provider, { value: screen }, <Part name="title-fade">x</Part>)
      )
    );

    const el = container.querySelector('[data-flemo-part-name="title-fade"]');
    expect(el?.getAttribute("data-flemo-status")).toBe("PUSHING");
    expect(el?.getAttribute("data-flemo-active")).toBe("false");

    act(() => {
      owningStores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
    });
    expect(el?.getAttribute("data-flemo-status")).toBe("COMPLETED");
  });
});
