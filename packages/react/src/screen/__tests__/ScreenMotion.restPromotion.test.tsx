import { type PropsWithChildren, type ReactNode, createElement } from "react";

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { History, TransitionName } from "@flemo/core";

import Screen from "@screen/Screen";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// The scope's compositor promotion has two halves, and only one is a device
// default. The REST half — the top screen keeping `will-change: transform`
// while nothing animates — is OPT-IN, because a promotion is also a STACKING
// CONTEXT: with it on, the scope becomes one for the whole consumer screen, and
// a consumer overlay rendered inside a screen can then never paint above the
// shared bars, which the binding renders as siblings at `z-index: 1`. Reported
// and reproduced on iOS Safari: an open bottom sheet (`position: fixed;
// z-index: 50`) came up UNDER the tab bar, and no z-index on the consumer's
// side could answer it.
let stores: FlemoStores;

const ENTRY: History = {
  id: "screen-1",
  pathname: "/",
  params: {},
  transitionName: "cupertino" as TransitionName
};

const SCREEN: ScreenContextProps = {
  id: "screen-1",
  isActive: true,
  isRoot: true,
  isPrev: false,
  zIndex: 0,
  pathname: "/",
  params: {},
  transitionName: "cupertino" as TransitionName,
  prevTransitionName: "cupertino" as TransitionName,
  routePath: "/"
};

beforeEach(() => {
  stores = createTestStores();
  stores.history.setState({ index: 0, histories: [ENTRY] });
  stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

function harness({ children }: PropsWithChildren): ReactNode {
  return createElement(
    StoreContext.Provider,
    { value: stores },
    createElement(ScreenContext.Provider, { value: SCREEN }, children)
  );
}

const renderScreen = () =>
  render(
    <Screen sharedBottomBar={<div>tabs</div>}>
      <div>home</div>
    </Screen>,
    { wrapper: harness }
  );

const scopeOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("[data-flemo-screen]")!;

describe("the resting top screen's scope", () => {
  it("carries no inline will-change, so a consumer overlay keeps its z-index", () => {
    const { container } = renderScreen();
    const scope = scopeOf(container);

    // At rest and on top: exactly the state a consumer opens a sheet in.
    expect(scope.getAttribute("data-flemo-anim-hold")).toBe("false");
    expect(scope.style.willChange).toBe("");
  });

  it("renders no promotion of its own for a flight either", () => {
    // A transition that animates nothing gets no engine stamp (the engine
    // gates every participant on its own definition), so whatever `will-change`
    // is on the scope here came from the BINDING. There must be none: a
    // binding-rendered promotion is what the engine's stamp captured as the
    // element's original and restored at every landing, leaving the scope a
    // permanent stacking context.
    const motionless = { ...SCREEN, transitionName: "none" as TransitionName };
    stores.navigate.setState({ status: "PUSHING", transitionTaskId: "task-1" });

    const { container } = render(
      <Screen sharedBottomBar={<div>tabs</div>}>
        <div>home</div>
      </Screen>,
      {
        wrapper: ({ children }: PropsWithChildren) =>
          createElement(
            StoreContext.Provider,
            { value: stores },
            createElement(ScreenContext.Provider, { value: motionless }, children)
          )
      }
    );

    expect(scopeOf(container).style.willChange).toBe("");
  });
});
