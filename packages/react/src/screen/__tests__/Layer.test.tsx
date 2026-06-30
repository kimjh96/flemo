import { createElement, type PropsWithChildren, type ReactNode } from "react";

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { TransitionName } from "@flemo/core";

import Screen from "@screen/Screen";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

import Layer from "../Layer";

let stores: FlemoStores;

beforeEach(() => {
  stores = createTestStores();
  stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
});

function harness(overrides: Partial<ScreenContextProps> = {}) {
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

describe("Layer", () => {
  it("portals its children to the screen's scope-level mount node, out of the content box", () => {
    stores.history.setState({ index: 0, histories: [] });

    const { container, getByTestId } = render(
      <Screen>
        <main>
          <Layer>
            <div data-testid="sheet">sheet</div>
          </Layer>
        </main>
      </Screen>,
      { wrapper: harness({ isActive: true }) }
    );

    const mount = container.querySelector("[data-flemo-layer-mount]");
    expect(mount).not.toBeNull();
    // Lifted up to the scope-level mount node...
    expect(mount!.contains(getByTestId("sheet"))).toBe(true);
    // ...and OUT of the content box (where it was authored, inside <main>).
    expect(container.querySelector("main")!.contains(getByTestId("sheet"))).toBe(false);
  });

  it("renders its children in place when used outside a Screen", () => {
    const { getByTestId } = render(
      <Layer>
        <div data-testid="free">free</div>
      </Layer>
    );

    expect(getByTestId("free")).toBeDefined();
  });
});
