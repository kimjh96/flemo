import { createElement, type PropsWithChildren, type ReactNode } from "react";

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import BarTransition from "@screen/BarTransition";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// BarTransition mirrors the screen's status (navigate store) and active flag
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

describe("BarTransition", () => {
  it("renders its child inside a wrapper carrying name + mirrored status/active", () => {
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });

    const { container, getByText } = render(
      <BarTransition name="title-fade">
        <span>Album Title</span>
      </BarTransition>,
      { wrapper: buildHarness(true) }
    );

    const el = container.querySelector('[data-flemo-bar-transition-name="title-fade"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute("data-flemo-status")).toBe("PUSHING");
    expect(el?.getAttribute("data-flemo-active")).toBe("true");
    expect(getByText("Album Title")).toBeTruthy();
  });

  it("reports active=false for the previous (inactive) screen's bar", () => {
    stores.navigate.setState({ status: "POPPING", transitionTaskId: null });

    const { container } = render(<BarTransition name="title-fade">x</BarTransition>, {
      wrapper: buildHarness(false)
    });

    const el = container.querySelector('[data-flemo-bar-transition-name="title-fade"]');
    expect(el?.getAttribute("data-flemo-active")).toBe("false");
    expect(el?.getAttribute("data-flemo-status")).toBe("POPPING");
  });
});
