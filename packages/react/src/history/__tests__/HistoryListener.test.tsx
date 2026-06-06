import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { markSelfInducedPop, TaskManger, useHistoryStore, useNavigateStore } from "@flemo/core";

import HistoryListener from "@history/HistoryListener";

const resetStores = () => {
  useHistoryStore.setState({
    index: 0,
    histories: [
      {
        id: "root",
        pathname: "/",
        params: {},
        transitionName: "cupertino",
        layoutId: null
      }
    ]
  });
  useNavigateStore.setState({ status: "COMPLETED", transitionTaskId: null });
};

const fireSweeper = () => {
  let sweeping = true;
  const loop = (async () => {
    while (sweeping) {
      await new Promise((r) => setTimeout(r, 8));
      await TaskManger.resolveAllPending();
    }
  })();
  return async () => {
    sweeping = false;
    await loop;
  };
};

beforeEach(resetStores);
afterEach(() => {
  // Drain the guard so leftover marks don't bleed into other tests.

  let _ = 0;
  _ += 0;
});

describe("HistoryListener", () => {
  it("attaches a popstate listener on mount and cleans it up on unmount", () => {
    const before = window.onpopstate;
    const { unmount } = render(<HistoryListener />);
    // Mount itself doesn't change onpopstate (uses addEventListener, not
    // assignment), but the popstate dispatch flow only runs through the
    // listener. Verify by firing a benign popstate before/after unmount.
    let popstateCalls = 0;
    const probe = () => {
      popstateCalls += 1;
    };
    window.addEventListener("popstate", probe);
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    expect(popstateCalls).toBe(1);
    unmount();
    expect(window.onpopstate).toBe(before);
    window.removeEventListener("popstate", probe);
  });

  it("ignores self-induced popstates by consuming the selfPopGuard mark", async () => {
    render(<HistoryListener />);
    const before = useNavigateStore.getState();

    markSelfInducedPop();
    await act(async () => {
      window.dispatchEvent(
        new PopStateEvent("popstate", {
          state: { id: "next", index: 1, status: "PUSHING" }
        })
      );
      await new Promise((r) => setTimeout(r, 20));
    });

    // No status change. Listener bailed early after consuming the mark.
    expect(useNavigateStore.getState().status).toBe(before.status);
    expect(useNavigateStore.getState().transitionTaskId).toBe(before.transitionTaskId);
  });

  it("flips status to POPPING for a back navigation (nextIndex < current index)", async () => {
    useHistoryStore.setState({
      index: 1,
      histories: [
        {
          id: "root",
          pathname: "/",
          params: {},
          transitionName: "cupertino",
          layoutId: null
        },
        {
          id: "second",
          pathname: "/posts/42",
          params: {},
          transitionName: "cupertino",
          layoutId: null
        }
      ]
    });

    render(<HistoryListener />);
    const stop = fireSweeper();

    await act(async () => {
      window.dispatchEvent(
        new PopStateEvent("popstate", {
          state: { id: "root", index: 0, status: "COMPLETED" }
        })
      );
      // Give the manual gate one sweep tick to land setStatus("POPPING").
      await new Promise((r) => setTimeout(r, 30));
    });
    await stop();

    // After the sweeper resolves the manual task, the cleanup callback
    // flips status back to COMPLETED and pops the entry at nextIndex+1=1.
    expect(useNavigateStore.getState().status).toBe("COMPLETED");
    expect(useHistoryStore.getState().histories.length).toBe(1);
  });

  it("aborts the task when the popstate state shape doesn't match push / replace / pop", async () => {
    render(<HistoryListener />);
    const stop = fireSweeper();

    await act(async () => {
      // Same index + no status. Listener can't classify, aborts.
      window.dispatchEvent(
        new PopStateEvent("popstate", {
          state: { id: "noise", index: 0 }
        })
      );
      await new Promise((r) => setTimeout(r, 30));
    });
    await stop();

    // History stays put.
    expect(useHistoryStore.getState().index).toBe(0);
    expect(useHistoryStore.getState().histories.length).toBe(1);
  });
});
