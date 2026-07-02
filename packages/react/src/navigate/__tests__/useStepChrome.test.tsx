import { createElement, type PropsWithChildren, type ReactNode } from "react";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { TaskManger } from "@flemo/core";

import useStep from "@navigate/useStep";

import ScreenContext from "@screen/ScreenContext";

import ScreenParamsDispatchContext from "@screen/ParamsProvider/ParamsDispatchContext";
import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// useStep called from CHROME (a header menu outside any <Screen>): there is no
// routePath and no ParamsProvider, so the hook subscribes to the driver itself,
// keeps the current pathname, appends the params as a query, and reports the
// step reactively through `step`.

let stores: FlemoStores;

function chromeHarness() {
  return function Harness({ children }: PropsWithChildren): ReactNode {
    return createElement(
      StoreContext.Provider,
      { value: stores },
      createElement(
        ScreenContext.Provider,
        {
          value: {
            id: "chrome",
            isActive: true,
            isRoot: true,
            isPrev: false,
            zIndex: 0,
            pathname: "/",
            params: {},
            transitionName: "cupertino",
            prevTransitionName: "cupertino",
            layoutId: null,
            // Chrome sits outside a <Screen>: no route to build from.
            routePath: ""
          }
        },
        createElement(ScreenParamsDispatchContext.Provider, { value: () => undefined }, children)
      )
    );
  };
}

beforeEach(() => {
  stores = createTestStores();
  window.history.replaceState(null, "", "/home");
});

describe("useStep from chrome (no routePath)", () => {
  it("starts with no step and reads an existing step frame on mount", () => {
    window.history.replaceState({ step: true, params: { menu: true } }, "", "/home");

    const { result } = renderHook(() => useStep<{ menu: boolean }>(), {
      wrapper: chromeHarness()
    });

    expect(result.current.step).toEqual({ menu: true });
  });

  it("pushes a step on the current pathname with the params as a query", async () => {
    const { result } = renderHook(() => useStep<{ menu: boolean }>(), {
      wrapper: chromeHarness()
    });

    expect(result.current.step).toBeNull();

    await act(async () => {
      await result.current.pushStep({ menu: true });
    });

    expect(window.location.pathname + window.location.search).toBe("/home?menu=true");
    expect(window.history.state?.step).toBe(true);
    expect(result.current.step).toEqual({ menu: true });

    await TaskManger.resolveAllPending();
  });

  it("clears the step when a traversal lands on a non-step frame", async () => {
    window.history.replaceState(null, "", "/home");
    window.history.pushState({ step: true, params: { menu: true } }, "", "/home?menu=true");

    const { result } = renderHook(() => useStep<{ menu: boolean }>(), {
      wrapper: chromeHarness()
    });
    expect(result.current.step).toEqual({ menu: true });

    await act(async () => {
      const traversed = new Promise<void>((resolve) => {
        const handler = () => {
          window.removeEventListener("popstate", handler);
          resolve();
        };
        window.addEventListener("popstate", handler);
      });
      window.history.back();
      await traversed;
    });

    expect(result.current.step).toBeNull();
  });
});
