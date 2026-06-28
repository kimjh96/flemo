import { createElement, type PropsWithChildren, type ReactNode } from "react";

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { TransitionName } from "@flemo/core";

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

  // The content wrapper (the flexGrow box that holds {children}) is promoted to
  // its own compositing layer while a transition is in flight, so a mid-transition
  // re-render repaints that layer instead of the transform-animated scope layer
  // (which would stall the transition's presentation on WebKit).
  it("isolates the content onto its own layer while a transition is in flight", () => {
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });
    stores.history.setState({ index: 0, histories: [] });

    const { getByTestId } = render(
      <Screen>
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true }) }
    );

    const contentWrapper = getByTestId("content").parentElement!;
    // Promoted via `transform: translateZ(0)`, NOT `will-change: opacity`: a
    // backdrop-root trigger would wash out a consumer `backdrop-filter` (frosted
    // header) for the duration of the transition, and that breaks on every push
    // of every frosted screen with no consumer-side workaround. A transform is
    // not a backdrop root, so blur keeps rendering.
    expect(contentWrapper.style.transform).toBe("translateZ(0)");
    expect(contentWrapper.style.willChange).toBe("transform");
  });

  it("drops the content layer once the transition settles", () => {
    // beforeEach leaves status COMPLETED.
    stores.history.setState({ index: 0, histories: [] });

    const { getByTestId } = render(
      <Screen>
        <div data-testid="content">hello</div>
      </Screen>,
      { wrapper: buildHarness({ isActive: true }) }
    );

    const contentWrapper = getByTestId("content").parentElement!;
    expect(contentWrapper.style.transform).toBe("");
    expect(contentWrapper.style.willChange).toBe("");
  });

  // The screen container is fixed to the viewport for a root <Router>, and
  // contained (position: absolute, anchored to its region) under a nested
  // <Router>. The container is the element carrying `contain: layout style`.
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
