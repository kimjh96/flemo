import { afterEach, beforeEach, describe, expect, it } from "vitest";

import TaskManager from "@core/TaskManger";

import createHistoryStore, { type History } from "@history/store";

import createNavigationController from "@navigate/createNavigationController";
import createNavigateStore from "@navigate/store";

import createTransitionStore from "@transition/store";

// The controller is framework-neutral: drive it with the core vanilla stores and
// a stub path compiler, no React. Each call parks a manual-gated task that a
// real binding resolves on `animationend`; here a sweeper repeatedly resolves
// pending tasks so push/pop advance in order.
const root: History = {
  id: "root",
  pathname: "/",
  params: {},
  transitionName: "cupertino",
  layoutId: null
};

const setup = () => {
  const stores = {
    history: createHistoryStore([root], 0),
    navigate: createNavigateStore(),
    transition: createTransitionStore("cupertino")
  };
  const controller = createNavigationController({
    stores,
    buildPathname: (path) => ({ pathname: path, toPathname: path })
  });
  return { stores, controller };
};

let stopSweeper: (() => Promise<void>) | null = null;
const startSweeper = () => {
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
};

beforeEach(startSweeper);
afterEach(async () => {
  await stopSweeper?.();
  stopSweeper = null;
});

describe("createNavigationController (headless, no React)", () => {
  it("push adds an entry and advances the index", async () => {
    const { stores, controller } = setup();
    await controller.push("/a");
    expect(stores.history.getState().index).toBe(1);
    expect(stores.history.getState().histories.at(-1)?.pathname).toBe("/a");
    expect(stores.navigate.getState().status).toBe("COMPLETED");
  });

  it("pop removes the top and settles", async () => {
    const { stores, controller } = setup();
    await controller.push("/a");
    await controller.pop();
    expect(stores.history.getState().index).toBe(0);
    expect(stores.history.getState().histories.at(-1)?.pathname).toBe("/");
    expect(stores.navigate.getState().status).toBe("COMPLETED");
  });

  it("replace swaps the top without growing the stack", async () => {
    const { stores, controller } = setup();
    await controller.push("/a");
    await controller.replace("/b");
    expect(stores.history.getState().index).toBe(1);
    expect(stores.history.getState().histories.at(-1)?.pathname).toBe("/b");
  });

  it("push honors the per-call transitionName override", async () => {
    const { stores, controller } = setup();
    await controller.push("/a", {}, { transitionName: "material" });
    expect(stores.history.getState().histories.at(-1)?.transitionName).toBe("material");
  });
});
