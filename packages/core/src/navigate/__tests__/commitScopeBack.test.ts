import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import createRouterScope, { type FlemoStores } from "@core/createRouterScope";
import TaskManager from "@core/TaskManger";

import type { HistoryDriver } from "@history/historyDriver";

import commitScopeBack from "@navigate/commitScopeBack";
import createNavigationController from "@navigate/createNavigationController";

// A browser Router's scope. Its driver is a stub because the point of the
// browser branch is that the commit stops AT the driver: the history sync
// (not mounted here) is what would carry it further.
const fakeBrowserDriver = (): HistoryDriver => ({
  readState: () => null,
  readPathname: () => "/",
  pushState: vi.fn(),
  replaceState: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  subscribe: () => () => {}
});

const baseInput = {
  routePaths: ["/", "/detail"],
  pathname: "/",
  search: "",
  defaultTransitionName: "cupertino" as const,
  hostedScope: null
};

const browserScope = (): FlemoStores =>
  createRouterScope({ ...baseInput, memory: false, browserDriver: fakeBrowserDriver() });

const memoryScope = (): FlemoStores =>
  createRouterScope({ ...baseInput, memory: true, browserDriver: null });

// Every navigation parks a manual-gated task a real binding resolves on
// `animationend`; sweep them so a commit can settle.
let stopSweeper: (() => Promise<void>) | null = null;

beforeEach(() => {
  let sweeping = true;
  const loop = (async () => {
    while (sweeping) {
      await new Promise((r) => setTimeout(r, 5));
      await TaskManager.resolveAllPending();
    }
  })();
  stopSweeper = async () => {
    sweeping = false;
    await loop;
  };
});

afterEach(async () => {
  await stopSweeper?.();
  stopSweeper = null;
});

// The binding's pop, which a memory scope's commit delegates to.
const scopePop = (stores: FlemoStores) => () => {
  void controllerFor(stores).pop();
};

const controllerFor = (stores: FlemoStores) =>
  createNavigationController({
    stores,
    buildPathname: (path) => ({ pathname: path, toPathname: path }),
    driver: stores.driver,
    markSelfInduced: stores.markSelfInduced
  });

const pushDetail = (stores: FlemoStores) => controllerFor(stores).push("/detail");

describe("commitScopeBack", () => {
  it("a browser scope commits through the driver and leaves the stores to the sync", () => {
    const stores = browserScope();
    const pop = vi.fn();

    commitScopeBack(stores, pop);

    expect(stores.driver.back).toHaveBeenCalledTimes(1);
    // Committing through the binding's pop as well would move the store ahead
    // of the browser AND mark a guard the sync then eats, so the traversal it
    // is about to hear would be dropped.
    expect(pop).not.toHaveBeenCalled();
    expect(stores.history.getState().index).toBe(0);
    expect(stores.consume()).toBe(false);
  });

  it("a memory scope pops its own stores, which no sync would do for it", async () => {
    const stores = memoryScope();
    await pushDetail(stores);
    expect(stores.history.getState().index).toBe(1);

    commitScopeBack(stores, scopePop(stores));
    // The commit is fire-and-forget (the swipe hands off and returns), so wait
    // on the stack itself — the status is already COMPLETED from the push.
    await vi.waitFor(() => expect(stores.history.getState().index).toBe(0));

    expect(stores.history.getState().histories).toHaveLength(1);
    expect(stores.history.getState().histories[0].pathname).toBe("/");
  });

  it("a memory scope's driver stays in step with the stores it popped", async () => {
    const stores = memoryScope();
    await pushDetail(stores);
    expect(stores.driver.readPathname()).toBe("/detail");

    commitScopeBack(stores, scopePop(stores));
    await vi.waitFor(() => expect(stores.history.getState().index).toBe(0));

    expect(stores.driver.readPathname()).toBe("/");
  });
});
