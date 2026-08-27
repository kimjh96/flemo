import { createElement, type PropsWithChildren, type ReactNode } from "react";

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { TransitionName } from "@flemo/core";

import Layer from "@screen/Layer";
import Screen from "@screen/Screen";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// <Layer> exists because of one CSS fact: a screen that moves carries a
// transform, and a transform is a containing block plus a stacking context for
// everything INSIDE it. So an overlay authored in the screen travels with the
// screen and cannot outrank the shared bars, which are outside. The escape is
// not a z-index — it is being a sibling of the scope rather than a descendant,
// which is what these tests pin.

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

const renderScreen = (children: ReactNode) =>
  render(<Screen>{children}</Screen>, { wrapper: buildHarness({ isActive: true }) });

describe("Layer", () => {
  it("renders its children outside the scope, in the screen container's host", () => {
    const { container, getByTestId } = renderScreen(
      <>
        <div data-testid="content">content</div>
        <Layer>
          <div data-testid="sheet">sheet</div>
        </Layer>
      </>
    );

    const scope = container.querySelector<HTMLElement>("[data-flemo-screen]")!;
    const host = container.querySelector<HTMLElement>("[data-flemo-layer-host]")!;
    const sheet = getByTestId("sheet");

    // The point of the whole component: a transform on the scope binds its
    // DESCENDANTS, so the sheet must not be one.
    expect(scope.contains(sheet)).toBe(false);
    expect(host.contains(sheet)).toBe(true);
    expect(scope.contains(getByTestId("content"))).toBe(true);
  });

  it("hosts the layer after the shared bars so an overlay covers them", () => {
    const { container } = render(
      <Screen sharedBottomBar={<nav data-testid="bar">bar</nav>}>
        <Layer>
          <div data-testid="sheet">sheet</div>
        </Layer>
      </Screen>,
      { wrapper: buildHarness({ isActive: true }) }
    );

    const host = container.querySelector<HTMLElement>("[data-flemo-layer-host]")!;
    const bar = container.querySelector<HTMLElement>('[data-flemo-bar="nav"]')!;

    // Same stacking context (the screen container), bar at 1 and host at 2 —
    // and the host comes later in tree order too, so neither rule alone is
    // carrying it.
    expect(host.parentElement).toBe(bar.parentElement);
    expect(host.style.zIndex).toBe("2");
    expect(bar.compareDocumentPosition(host) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("gives the host nothing that would trap a fixed child", () => {
    const { container } = renderScreen(
      <Layer>
        <div data-testid="sheet">sheet</div>
      </Layer>
    );

    const host = container.querySelector<HTMLElement>("[data-flemo-layer-host]")!;

    // A transform, containment, or a promotion here would re-create on the
    // host exactly the containing block the component exists to escape.
    expect(host.style.transform).toBe("");
    expect(host.style.contain).toBe("");
    expect(host.style.willChange).toBe("");
  });

  it("confines the screen's own content with layout containment on the scope", () => {
    const { container } = renderScreen(<div data-testid="content">content</div>);

    const scope = container.querySelector<HTMLElement>("[data-flemo-screen]")!;

    expect(scope.style.contain).toBe("layout style");
  });

  it("renders nothing when there is no host", () => {
    const { queryByTestId } = render(
      <Layer>
        <div data-testid="orphan">orphan</div>
      </Layer>,
      { wrapper: buildHarness({ isActive: true }) }
    );

    expect(queryByTestId("orphan")).toBeNull();
  });
});
