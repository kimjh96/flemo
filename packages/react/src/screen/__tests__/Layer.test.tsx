import { createElement, type PropsWithChildren, type ReactNode } from "react";

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { OVERLAY_LEVEL, type TransitionName } from "@flemo/core";

import Layer from "@screen/Layer";
import Screen from "@screen/Screen";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";
import ScreenMotion from "@screen/ScreenMotion";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// <Layer> takes an overlay OUT of its screen, because a moving screen is a
// stacking context and an overlay that has to cover the shared bars cannot be
// inside one with them. jsdom does no layout and no paint, so what it can pin
// is not what the overlay covers — that is e2e's job — but everything about
// WHERE the overlay lands and WHOSE it still is.
//
// Which is the half that was wrong before. The escape is easy; keeping the
// escaped thing attached to the screen it belongs to is the design.

let stores: FlemoStores;

beforeEach(() => {
  stores = createTestStores();
  stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
  stores.history.setState({ index: 0, histories: [] });
});

const screenContext = (overrides: Partial<ScreenContextProps> = {}): ScreenContextProps => ({
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
});

function harness(overrides: Partial<ScreenContextProps> = {}) {
  const screen = screenContext(overrides);

  return function Harness({ children }: PropsWithChildren): ReactNode {
    return createElement(
      StoreContext.Provider,
      { value: stores },
      createElement(ScreenContext.Provider, { value: screen }, children)
    );
  };
}

const host = (root: HTMLElement) => root.querySelector<HTMLElement>("[data-flemo-layer-host]");
const slots = (root: HTMLElement) => [
  ...root.querySelectorAll<HTMLElement>("[data-flemo-layer-slot]")
];

describe("Layer", () => {
  it("renders nothing at all without a screen to belong to", () => {
    // No host and no owner: rather than portal into the document and become
    // everyone's problem, it declines. This is also the server's answer, where
    // the host element does not exist yet.
    const { container } = render(
      <Layer>
        <div data-testid="sheet" />
      </Layer>
    );

    expect(container.querySelector("[data-testid='sheet']")).toBeNull();
  });

  it("puts the overlay beside the screen rather than inside it", () => {
    const { container } = render(
      <Screen sharedBottomBar={<nav data-testid="bar" />} sharedBottomBarId="bar">
        <div data-testid="content" />
        <Layer>
          <div data-testid="sheet" />
        </Layer>
      </Screen>,
      { wrapper: harness() }
    );

    const scope = container.querySelector<HTMLElement>("[data-flemo-screen]")!;
    const sheet = container.querySelector<HTMLElement>("[data-testid='sheet']")!;

    // The whole point, stated as containment: the screen's transform binds its
    // DESCENDANTS, so being out of the scope is what makes the overlay
    // unreachable by it.
    expect(scope.contains(container.querySelector("[data-testid='content']"))).toBe(true);
    expect(scope.contains(sheet)).toBe(false);
    expect(host(container)!.contains(sheet)).toBe(true);
  });

  it("keeps the host clear of pointers and the overlay's own children hit-testable", () => {
    const { container } = render(
      <Screen>
        <Layer>
          <div data-testid="sheet" />
        </Layer>
      </Screen>,
      { wrapper: harness() }
    );

    // Host and slot both span the whole region. If either took pointers, an
    // overlay that only draws a sheet at the bottom would silently eat every
    // tap above it.
    expect(host(container)!.style.pointerEvents).toBe("none");
    expect(slots(container)[0]!.style.pointerEvents).toBe("none");
    // And the consumer's own content gets them back, through a wrapper that
    // generates no box of its own.
    const wrapper = container.querySelector<HTMLElement>("[data-testid='sheet']")!
      .parentElement as HTMLElement;
    expect(wrapper.style.display).toBe("contents");
    expect(wrapper.style.pointerEvents).toBe("auto");
  });

  it("stacks the host over the screen's chrome", () => {
    const { container } = render(
      <Screen sharedBottomBar={<nav />} sharedBottomBarId="bar">
        <Layer>
          <div data-testid="sheet" />
        </Layer>
      </Screen>,
      { wrapper: harness() }
    );

    expect(Number(host(container)!.style.zIndex)).toBe(OVERLAY_LEVEL);
  });

  it("carries its owner's flight so the compiled rule moves it with the screen", () => {
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: null });

    const { container } = render(
      <Screen>
        <Layer>
          <div data-testid="sheet" />
        </Layer>
      </Screen>,
      // Active, so the status the scope resolves is the live PUSHING rather
      // than the COMPLETED a resting deep screen pins — otherwise a slot that
      // simply hardcoded the default would satisfy the comparison below.
      { wrapper: harness({ isActive: true, transitionName: "material" as TransitionName }) }
    );

    const slot = slots(container)[0]!;
    const scope = container.querySelector<HTMLElement>("[data-flemo-screen]")!;

    // The slot is a sibling of no scope it belongs to, so nothing moves it
    // when the screen moves — unless these say which flight it is in. The
    // compiled screen rule pairs on exactly this triple (see
    // layerSlotSelector), the same way a riding shared bar does.
    //
    // Asserted AGAINST THE SCOPE rather than against literals, because the
    // scope's own status is derived (a resting deep screen pins it) and a
    // slot that agreed with a literal while disagreeing with its screen would
    // be the exact failure this pins: two elements, one flight, one clock.
    for (const attribute of [
      "data-flemo-transition",
      "data-flemo-status",
      "data-flemo-active",
      "data-flemo-anim-hold"
    ]) {
      expect(slot.getAttribute(attribute)).toBe(scope.getAttribute(attribute));
      expect(slot.getAttribute(attribute)).not.toBeNull();
    }
    expect(slot.getAttribute("data-flemo-transition")).toBe("material");
  });

  it("goes dark with a covered screen, which CSS alone cannot make it do", () => {
    // A covered screen stops painting through `visibility: hidden` on its
    // container, and that is plain CSS: it reaches the container's own DOM
    // descendants and stops. The slot is in another box, so it has to be told.
    //
    // React's freeze does cross the portal (see ScreenFreeze.portal.test.tsx),
    // but it lands on a later clock — debounced on desktop Blink — so without
    // this the overlay is the one thing still painting on a screen that is
    // already covered.
    // Driven through ScreenMotion rather than Screen, because the window this
    // is about is the one BETWEEN the two clocks: paint stops in the covering
    // commit while the freeze is debounced behind it. Going through <Screen>
    // would arrive with both already applied — and React detaches refs inside
    // a hidden Activity, so the host would never even be handed over.
    const { container, rerender } = render(
      <StoreContext.Provider value={stores}>
        <ScreenContext.Provider value={screenContext()}>
          <ScreenMotion paintHidden={false}>
            <Layer>
              <div data-testid="sheet" />
            </Layer>
          </ScreenMotion>
        </ScreenContext.Provider>
      </StoreContext.Provider>
    );

    expect(slots(container)[0]!.style.visibility).toBe("");

    rerender(
      <StoreContext.Provider value={stores}>
        <ScreenContext.Provider value={screenContext()}>
          <ScreenMotion paintHidden={true}>
            <Layer>
              <div data-testid="sheet" />
            </Layer>
          </ScreenMotion>
        </ScreenContext.Provider>
      </StoreContext.Provider>
    );

    const screenContainer = container.firstElementChild as HTMLElement;
    expect(screenContainer.style.visibility).toBe("hidden");
    expect(slots(container)[0]!.style.visibility).toBe("hidden");
  });

  it("orders two screens' overlays by their screens, not by which mounted first", () => {
    // Mounted deepest-first on purpose: portal insertion order would give the
    // opposite answer, which is exactly the bug a single shared host has.
    const { container } = render(
      <div>
        <StoreContext.Provider value={stores}>
          <ScreenContext.Provider value={screenContext({ id: "below", zIndex: 3 })}>
            <Screen>
              <Layer>
                <div data-testid="above-sheet" />
              </Layer>
            </Screen>
          </ScreenContext.Provider>
          <ScreenContext.Provider value={screenContext({ id: "top", zIndex: 1 })}>
            <Screen>
              <Layer>
                <div data-testid="below-sheet" />
              </Layer>
            </Screen>
          </ScreenContext.Provider>
        </StoreContext.Provider>
      </div>
    );

    const [first, second] = slots(container);
    expect(Number(first!.style.zIndex)).toBe(3);
    expect(Number(second!.style.zIndex)).toBe(1);
  });

  describe("inside a nested screen", () => {
    const nested = (inner: ReactNode) =>
      render(
        <StoreContext.Provider value={stores}>
          <ScreenContext.Provider value={screenContext({ id: "outer", zIndex: 0 })}>
            <Screen sharedBottomBar={<nav data-testid="outer-bar" />} sharedBottomBarId="tabs">
              <ScreenContext.Provider value={screenContext({ id: "inner", zIndex: 2 })}>
                <Screen>{inner}</Screen>
              </ScreenContext.Provider>
            </Screen>
          </ScreenContext.Provider>
        </StoreContext.Provider>
      );

    it("hosts the overlay in the outermost screen, past the ancestor's chrome", () => {
      const { container } = nested(
        <Layer>
          <div data-testid="sheet" />
        </Layer>
      );

      // One host for the chain, and it is the OUTER screen's. A host in the
      // inner container would be one box too deep to reach a bar the outer
      // screen declared — measured, and the reason this is not per-screen.
      const hosts = container.querySelectorAll("[data-flemo-layer-host]");
      expect(hosts).toHaveLength(1);

      const outerScope = container.querySelector<HTMLElement>("[data-flemo-screen]")!;
      expect(outerScope.contains(hosts[0]!)).toBe(false);
      expect(hosts[0]!.contains(container.querySelector("[data-testid='sheet']"))).toBe(true);
    });

    it("still stacks the overlay by the INNER screen that opened it", () => {
      const { container } = nested(
        <Layer>
          <div data-testid="sheet" />
        </Layer>
      );

      // Hoisting the box must not hoist the ownership. The slot sits in the
      // outer container and is still the inner screen's, which is what #344
      // gave up by sharing one host with no owner on it.
      expect(Number(slots(container)[0]!.style.zIndex)).toBe(2);
    });
  });
});
