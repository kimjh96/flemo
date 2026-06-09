import { createElement, type PropsWithChildren, type ReactNode } from "react";

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { TransitionName } from "@flemo/core";

import Screen from "@screen/Screen";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";

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
});
