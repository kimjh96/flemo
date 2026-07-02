import { afterEach, describe, expect, it, vi } from "vitest";

import TaskManager from "@core/TaskManger";

import type { HistoryDriver, HistoryNavEvent } from "@history/historyDriver";
import createHistoryStore from "@history/store";

import type { History } from "@history/store";

import createStepController, {
  appendParamsQuery,
  readStepParams,
  subscribeStepParamsRestore
} from "@navigate/createStepController";
import createNavigateStore from "@navigate/store";

const historyEntry = (id: string): History => ({
  id,
  pathname: `/${id}`,
  params: {},
  transitionName: "cupertino" as History["transitionName"],
  layoutId: null
});

// An in-test driver capturing pushes/replaces and letting a test fire the
// traversal event `back()` would produce.
function createFakeDriver(initialState: unknown = null) {
  let state = initialState;
  const listeners = new Set<(event: HistoryNavEvent) => void>();
  const calls: { type: string; state: unknown; url?: string }[] = [];
  let backTraversalState: unknown;
  let firesTraversal = false;

  const driver: HistoryDriver = {
    readState: () => state,
    readPathname: () => "/current",
    pushState: (nextState, url) => {
      state = nextState;
      calls.push({ type: "push", state: nextState, url });
    },
    replaceState: (nextState, url) => {
      state = nextState;
      calls.push({ type: "replace", state: nextState, url });
    },
    go: () => {},
    back: () => {
      if (!firesTraversal) return;
      queueMicrotask(() => {
        listeners.forEach((listener) => listener({ state: backTraversalState, pathname: "/prev" }));
      });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };

  return {
    driver,
    calls,
    fireTraversalOnBack: (eventState: unknown) => {
      firesTraversal = true;
      backTraversalState = eventState;
    }
  };
}

const buildDeps = (fake: ReturnType<typeof createFakeDriver>) => {
  const stores = {
    history: createHistoryStore([historyEntry("a"), historyEntry("b")], 1),
    navigate: createNavigateStore()
  };
  const applyParams = vi.fn();
  const markSelfInduced = vi.fn();
  const controller = createStepController({
    stores,
    driver: fake.driver,
    markSelfInduced,
    buildStepPathname: (params) => appendParamsQuery("/current", params),
    applyParams
  });
  return { stores, applyParams, markSelfInduced, controller };
};

// The screen-pop branch of popStep enqueues a `manual: true` task that pauses
// until the binding's `animationend` releases it. There is no animation here,
// so a background sweeper repeatedly resolves pending tasks (same pattern the
// React binding's tests use).
const startManualGateSweeper = () => {
  let sweeping = true;
  const sweeper = (async () => {
    while (sweeping) {
      await new Promise((resolve) => setTimeout(resolve, 8));
      await TaskManager.resolveAllPending();
    }
  })();
  return async () => {
    sweeping = false;
    await sweeper;
  };
};

afterEach(async () => {
  await TaskManager.resolveAllPending();
});

describe("readStepParams", () => {
  it("returns the params only for a step frame", () => {
    expect(readStepParams({ step: true, params: { open: "menu" } })).toEqual({ open: "menu" });
    expect(readStepParams({ step: true })).toEqual({});
    expect(readStepParams({ step: false, params: { open: "menu" } })).toBeNull();
    expect(readStepParams(null)).toBeNull();
  });
});

describe("appendParamsQuery", () => {
  it("appends params as a query on the pathname", () => {
    expect(appendParamsQuery("/posts", { open: "picker", page: 2 })).toBe(
      "/posts?open=picker&page=2"
    );
  });

  it("returns the pathname unchanged for empty params", () => {
    expect(appendParamsQuery("/posts", {})).toBe("/posts");
  });
});

describe("createStepController", () => {
  it("pushStep marks the current frame as a step boundary, pushes the step, applies params", async () => {
    const fake = createFakeDriver({ some: "frame" });
    const { applyParams, controller } = buildDeps(fake);

    await controller.pushStep({ open: "picker" });

    expect(fake.calls[0]).toEqual({
      type: "replace",
      state: { some: "frame", step: true },
      url: "/current"
    });
    expect(fake.calls[1]).toEqual({
      type: "push",
      state: { some: "frame", step: true, params: { open: "picker" } },
      url: "/current?open=picker"
    });
    expect(applyParams).toHaveBeenCalledWith({ open: "picker" });
  });

  it("pushStep does not re-mark a frame that is already a step boundary", async () => {
    const fake = createFakeDriver({ step: true, params: { open: "a" } });
    const { controller } = buildDeps(fake);

    await controller.pushStep({ open: "b" });

    expect(fake.calls.map((call) => call.type)).toEqual(["push"]);
  });

  it("replaceStep replaces the current frame in place", async () => {
    const fake = createFakeDriver({ step: true, params: { open: "a" } });
    const { applyParams, controller } = buildDeps(fake);

    await controller.replaceStep({ open: "b" });

    expect(fake.calls).toEqual([
      {
        type: "replace",
        state: { step: true, params: { open: "b" } },
        url: "/current?open=b"
      }
    ]);
    expect(applyParams).toHaveBeenCalledWith({ open: "b" });
  });

  it("popStep landing on a step frame applies its params without a screen pop", async () => {
    const fake = createFakeDriver({ step: true, params: { open: "picker" } });
    fake.fireTraversalOnBack({ step: true, params: { open: "menu" } });
    const { stores, applyParams, markSelfInduced, controller } = buildDeps(fake);

    await controller.popStep();

    expect(markSelfInduced).toHaveBeenCalled();
    expect(applyParams).toHaveBeenCalledWith({ open: "menu" });
    expect(stores.navigate.getState().status).toBe("IDLE");
    expect(stores.history.getState().index).toBe(1);
  });

  it("popStep crossing the boundary into a screen frame runs the pop lifecycle", async () => {
    const fake = createFakeDriver({ step: true, params: {} });
    fake.fireTraversalOnBack({ step: false });
    const { stores, controller } = buildDeps(fake);

    const stopSweeper = startManualGateSweeper();
    await controller.popStep();
    await stopSweeper();

    expect(stores.navigate.getState().status).toBe("COMPLETED");
    expect(stores.history.getState().index).toBe(0);
  });

  it("popStep aborts safely when no traversal arrives (safety timeout)", async () => {
    const fake = createFakeDriver({ step: true, params: {} });
    // back() produces no traversal event.
    const { stores, applyParams, controller } = buildDeps(fake);

    await controller.popStep();

    expect(applyParams).not.toHaveBeenCalled();
    expect(stores.navigate.getState().status).toBe("IDLE");
    expect(stores.history.getState().index).toBe(1);
  });
});

describe("subscribeStepParamsRestore", () => {
  it("restores params for step frames only, through the task queue", async () => {
    const listeners = new Set<(event: { state: unknown; pathname: string }) => void>();
    const driver = {
      subscribe: (listener: (event: { state: unknown; pathname: string }) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    } as unknown as HistoryDriver;
    const onParams = vi.fn();

    const dispose = subscribeStepParamsRestore(driver, onParams);

    // A screen frame: ignored.
    listeners.forEach((listener) => listener({ state: { step: false }, pathname: "/a" }));
    await TaskManager.resolveAllPending();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(onParams).not.toHaveBeenCalled();

    // A step frame: params restored (empty object when absent).
    listeners.forEach((listener) =>
      listener({ state: { step: true, params: { open: "menu" } }, pathname: "/a" })
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onParams).toHaveBeenCalledWith({ open: "menu" });

    listeners.forEach((listener) => listener({ state: { step: true }, pathname: "/a" }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onParams).toHaveBeenLastCalledWith({});

    dispose();
    expect(listeners.size).toBe(0);
  });
});
