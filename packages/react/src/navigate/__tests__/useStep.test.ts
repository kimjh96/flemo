import { createElement, type PropsWithChildren, type ReactNode } from "react";

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TaskManger } from "@flemo/core";

import useStep from "@navigate/useStep";

import ScreenContext from "@screen/ScreenContext";

import ScreenParamsDispatchContext, {
  type ParamsDispatchContextType
} from "@screen/ParamsProvider/ParamsDispatchContext";
import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// `useStep` reads the active screen's routePath from ScreenContext and the
// params reducer from ScreenParamsDispatchContext. Provide both with a thin
// harness so we can exercise pushStep / replaceStep / popStep without
// mounting a full Router tree.

declare module "@Route" {
  interface RegisterRoute {
    "/posts/:id": { id: string; tab?: string };
  }
}

interface HarnessProps extends PropsWithChildren {
  routePath: string;
  dispatch?: (action: ParamsDispatchContextType) => void;
}

function buildHarness(routePath: string, dispatch: HarnessProps["dispatch"]) {
  function Harness({ children }: PropsWithChildren): ReactNode {
    return createElement(
      StoreContext.Provider,
      { value: stores },
      createElement(
        ScreenContext.Provider,
        {
          value: {
            id: "screen-1",
            isActive: true,
            isRoot: false,
            isPrev: false,
            zIndex: 0,
            pathname: "/posts/1",
            params: { id: "1" },
            transitionName: "cupertino",
            prevTransitionName: "cupertino",
            layoutId: null,
            routePath
          }
        },
        createElement(
          ScreenParamsDispatchContext.Provider,
          { value: dispatch ?? (() => undefined) },
          children
        )
      )
    );
  }
  return Harness;
}

// Resolve any leftover manual-task in the TaskManger so the next test's
// task queue starts clean. ScreenMotion would call this via `animationend`
// at runtime; in jsdom there's no animation, so we sweep here.
const drainTaskManger = async () => {
  await TaskManger.resolveAllPending();
};

// The screen-pop branch of popStep enqueues a `manual: true` task that pauses in
// MANUAL_PENDING until ScreenMotion's `animationend` releases it. jsdom fires no
// animation, so a background sweeper repeatedly calls `resolveAllPending` to let
// the completion fn (popHistory + setStatus) run.
const startManualGateSweeper = () => {
  let sweeping = true;
  const sweeper = (async () => {
    while (sweeping) {
      await new Promise((r) => setTimeout(r, 8));
      await TaskManger.resolveAllPending();
    }
  })();
  return async () => {
    sweeping = false;
    await sweeper;
  };
};

let stores: FlemoStores;

const resetStores = () => {
  stores = createTestStores();
  stores.history.setState({
    index: 0,
    histories: [
      {
        id: "screen-1",
        pathname: "/posts/1",
        params: { id: "1" },
        transitionName: "cupertino",
        layoutId: null
      }
    ]
  });
  stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
  window.history.replaceState(null, "", "/posts/1");
};

beforeEach(resetStores);
afterEach(async () => {
  await drainTaskManger();
});

describe("useStep: pushStep", () => {
  it("rewrites the current entry to step:true on the first call, then pushes a step entry", async () => {
    const dispatches: ParamsDispatchContextType[] = [];
    const { result } = renderHook(() => useStep<"/posts/:id">(), {
      wrapper: buildHarness("/posts/:id", (action) => dispatches.push(action))
    });

    await act(async () => {
      await result.current.pushStep({ id: "1", tab: "comments" });
    });

    // History entry state at the top of the stack carries step:true + params.
    expect(window.history.state?.step).toBe(true);
    expect(window.history.state?.params).toEqual({ id: "1", tab: "comments" });
    // Dispatch fired with the new params.
    expect(dispatches).toContainEqual({ type: "SET", params: { id: "1", tab: "comments" } });
  });

  it("only flips the previous entry to step:true once (no double-pushed flag)", async () => {
    const { result } = renderHook(() => useStep<"/posts/:id">(), {
      wrapper: buildHarness("/posts/:id", () => undefined)
    });

    await act(async () => {
      await result.current.pushStep({ id: "1", tab: "a" });
    });
    await act(async () => {
      await result.current.pushStep({ id: "1", tab: "b" });
    });

    // The browser's current state should be the second push.
    expect(window.history.state?.params).toEqual({ id: "1", tab: "b" });
  });
});

describe("useStep: replaceStep", () => {
  it("mutates the current entry's params in place (no new history entry)", async () => {
    const dispatches: ParamsDispatchContextType[] = [];
    const { result } = renderHook(() => useStep<"/posts/:id">(), {
      wrapper: buildHarness("/posts/:id", (action) => dispatches.push(action))
    });

    const lengthBefore = window.history.length;
    await act(async () => {
      await result.current.replaceStep({ id: "1", tab: "edited" });
    });

    // replaceState doesn't extend history.length.
    expect(window.history.length).toBe(lengthBefore);
    expect(window.history.state?.step).toBe(true);
    expect(window.history.state?.params).toEqual({ id: "1", tab: "edited" });
    expect(dispatches).toContainEqual({ type: "SET", params: { id: "1", tab: "edited" } });
  });
});

describe("useStep: popStep", () => {
  it("aborts without a screen pop when back() lands on an unrecognized (null-state) entry", async () => {
    // A step entry sits on top of a base entry whose history state is null,
    // e.g. the user arrived via a plain browser navigation. `back()` surfaces
    // that null state, which popStep treats as "nothing to pop": it aborts the
    // task and leaves the navigate store untouched (no POPPING).
    window.history.replaceState(null, "", "/posts/1");
    window.history.pushState({ step: true, params: { id: "1", tab: "comments" } }, "", "/posts/1");

    const dispatches: ParamsDispatchContextType[] = [];
    const { result } = renderHook(() => useStep<"/posts/:id">(), {
      wrapper: buildHarness("/posts/:id", (action) => dispatches.push(action))
    });

    await act(async () => {
      await result.current.popStep();
    });

    // Abort branch: no dispatch, no screen-pop status change.
    expect(dispatches).toHaveLength(0);
    expect(stores.navigate.getState().status).toBe("COMPLETED");
    expect(stores.history.getState().index).toBe(0);
  });

  it("applies the prior params in place when back() lands on another step entry", async () => {
    // Two step entries stacked on the same screen. `back()` surfaces the lower
    // step's state, so popStep stays a step pop: it dispatches the prior params
    // and aborts the task without touching the navigate store.
    window.history.replaceState({ step: true, params: { id: "1", tab: "first" } }, "", "/posts/1");
    window.history.pushState({ step: true, params: { id: "1", tab: "second" } }, "", "/posts/1");

    const dispatches: ParamsDispatchContextType[] = [];
    const { result } = renderHook(() => useStep<"/posts/:id">(), {
      wrapper: buildHarness("/posts/:id", (action) => dispatches.push(action))
    });

    await act(async () => {
      await result.current.popStep();
    });

    expect(dispatches).toContainEqual({ type: "SET", params: { id: "1", tab: "first" } });
    // Step pop never enters the screen-pop status flow.
    expect(stores.navigate.getState().status).toBe("COMPLETED");
    expect(stores.history.getState().index).toBe(0);
  });

  it("dispatches empty params when the prior step entry stored none", async () => {
    // A step entry recorded without params (state.params undefined) falls back
    // to `{}` so the reducer always receives an object.
    window.history.replaceState({ step: true }, "", "/posts/1");
    window.history.pushState({ step: true, params: { id: "1", tab: "second" } }, "", "/posts/1");

    const dispatches: ParamsDispatchContextType[] = [];
    const { result } = renderHook(() => useStep<"/posts/:id">(), {
      wrapper: buildHarness("/posts/:id", (action) => dispatches.push(action))
    });

    await act(async () => {
      await result.current.popStep();
    });

    expect(dispatches).toContainEqual({ type: "SET", params: {} });
  });

  it("crosses the step boundary into a screen pop when back() lands on a non-step entry", async () => {
    // Two-entry stack with a step entry on top of the base screen entry. `back()`
    // lands on the base (step:false), so popStep treats it as a screen pop:
    // status → POPPING, then the completion fn pops the history entry and settles
    // back to COMPLETED.
    stores.history.setState({
      index: 1,
      histories: [
        {
          id: "screen-1",
          pathname: "/posts/1",
          params: { id: "1" },
          transitionName: "cupertino",
          layoutId: null
        },
        {
          id: "screen-1",
          pathname: "/posts/1",
          params: { id: "1", tab: "comments" },
          transitionName: "cupertino",
          layoutId: null
        }
      ]
    });
    window.history.replaceState({ step: false, params: { id: "1" } }, "", "/posts/1");
    window.history.pushState({ step: true, params: { id: "1", tab: "comments" } }, "", "/posts/1");

    const { result } = renderHook(() => useStep<"/posts/:id">(), {
      wrapper: buildHarness("/posts/:id", () => undefined)
    });

    const stopSweeper = startManualGateSweeper();
    await act(async () => {
      await result.current.popStep();
    });
    await stopSweeper();

    // The screen-pop completion fn ran: history entry dropped, status settled.
    expect(stores.history.getState().index).toBe(0);
    expect(stores.history.getState().histories).toHaveLength(1);
    expect(stores.navigate.getState().status).toBe("COMPLETED");
    expect(stores.navigate.getState().transitionTaskId).not.toBeNull();
  });
});
