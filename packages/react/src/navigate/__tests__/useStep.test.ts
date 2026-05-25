import { createElement, type PropsWithChildren, type ReactNode } from "react";

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TaskManger, useHistoryStore, useNavigateStore } from "@flemo/core";

import useStep from "@navigate/useStep";

import ScreenContext from "@screen/ScreenContext";

import ScreenParamsDispatchContext, {
  type ParamsDispatchContextType
} from "@screen/ParamsProvider/ParamsDispatchContext";

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

const resetStores = () => {
  useHistoryStore.setState({
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
  useNavigateStore.setState({ status: "COMPLETED", transitionTaskId: null });
  window.history.replaceState(null, "", "/posts/1");
};

beforeEach(resetStores);
afterEach(async () => {
  await drainTaskManger();
});

describe("useStep — pushStep", () => {
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

describe("useStep — replaceStep", () => {
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

describe("useStep — popStep", () => {
  it("falls back to abort when there is no history to pop (safety timeout)", async () => {
    // Fresh history with a single entry — `history.back()` produces no
    // popstate, and the safety timeout fires after ~200ms.
    const { result } = renderHook(() => useStep<"/posts/:id">(), {
      wrapper: buildHarness("/posts/:id", () => undefined)
    });
    const lengthBefore = window.history.length;
    await act(async () => {
      await result.current.popStep();
    });
    expect(window.history.length).toBe(lengthBefore);
  });
});
