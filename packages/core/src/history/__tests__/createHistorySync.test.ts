import { afterEach, beforeEach, describe, expect, it } from "vitest";

import TaskManager from "@core/TaskManger";

import createHistorySync from "@history/createHistorySync";
import createHistoryStore, { type History } from "@history/store";

import { markSelfInducedPop } from "@navigate/selfPopGuard";
import createNavigateStore from "@navigate/store";

// createHistorySync is framework-neutral: it attaches a popstate listener that
// classifies each browser Back/Forward against the core vanilla stores and parks
// a manual-gated task. Here a sweeper resolves pending tasks so the bridge
// advances, exactly like a real binding's `animationend` resolver — no React.
const root: History = {
  id: "root",
  pathname: "/",
  params: {},
  transitionName: "cupertino",
  layoutId: null
};

const setup = (histories: History[] = [root], index = 0) => {
  const stores = {
    history: createHistoryStore(histories, index),
    navigate: createNavigateStore()
  };
  const dispose = createHistorySync({ stores });
  return { stores, dispose };
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

const firePopState = (state: Record<string, unknown>) =>
  window.dispatchEvent(new PopStateEvent("popstate", { state }));

// Let the handler park its task, the sweeper resolve it, and the result run.
const settle = () => new Promise((r) => setTimeout(r, 40));

describe("createHistorySync (headless, no React)", () => {
  it("a forward (push) popstate adds the entry and settles COMPLETED", async () => {
    const { stores, dispose } = setup();
    firePopState({
      id: "a",
      index: 1,
      status: "PUSHING",
      params: {},
      transitionName: "cupertino",
      layoutId: null
    });
    await settle();

    expect(stores.history.getState().index).toBe(1);
    expect(stores.history.getState().histories.at(-1)?.id).toBe("a");
    expect(stores.navigate.getState().status).toBe("COMPLETED");
    dispose();
  });

  it("a back (pop) popstate pops the top and settles COMPLETED", async () => {
    const a: History = { ...root, id: "a", pathname: "/a" };
    const { stores, dispose } = setup([root, a], 1);
    firePopState({ id: "root", index: 0, status: "POPPING" });
    await settle();

    expect(stores.history.getState().index).toBe(0);
    expect(stores.history.getState().histories).toHaveLength(1);
    expect(stores.history.getState().histories.at(-1)?.id).toBe("root");
    expect(stores.navigate.getState().status).toBe("COMPLETED");
    dispose();
  });

  it("a forward (replace) popstate adds the entry via addHistory", async () => {
    const { stores, dispose } = setup();
    firePopState({
      id: "b",
      index: 1,
      status: "REPLACING",
      params: {},
      transitionName: "material",
      layoutId: null
    });
    await settle();

    expect(stores.history.getState().index).toBe(1);
    expect(stores.history.getState().histories.at(-1)?.id).toBe("b");
    expect(stores.navigate.getState().status).toBe("COMPLETED");
    dispose();
  });

  it("an unrecognized popstate (no index change) is ignored", async () => {
    const { stores, dispose } = setup();
    firePopState({ id: "root", index: 0, status: "COMPLETED" });
    await settle();

    expect(stores.history.getState().index).toBe(0);
    expect(stores.history.getState().histories).toHaveLength(1);
    dispose();
  });

  it("a flemo-induced popstate is skipped via the self-pop guard", async () => {
    const { stores, dispose } = setup();
    markSelfInducedPop();
    firePopState({ id: "a", index: 1, status: "PUSHING" });
    await settle();

    expect(stores.history.getState().index).toBe(0);
    expect(stores.history.getState().histories).toHaveLength(1);
    dispose();
  });

  it("a REPLACING popstate that does not advance the index is ignored", async () => {
    const { stores, dispose } = setup();
    firePopState({ id: "x", index: 0, status: "REPLACING" });
    await settle();

    expect(stores.history.getState().index).toBe(0);
    expect(stores.history.getState().histories).toHaveLength(1);
    dispose();
  });

  it("adopts an unclassifiable entry that belongs to this router (URL and screen never diverge)", async () => {
    // A forward jump into territory written before a remount: same index as the
    // store, but a DIFFERENT entry id — no faithful animated reconstruction
    // exists, so the sync rewrites the top in place without a transition.
    const { stores } = setup([root, { ...root, id: "shown", pathname: "/shown" }], 1);

    firePopState({
      id: "orphaned",
      index: 1,
      status: "PUSHING",
      params: { n: "3" },
      transitionName: "cupertino",
      layoutId: null
    });
    await settle();

    const { histories, index } = stores.history.getState();
    expect(index).toBe(1);
    expect(histories[1]).toMatchObject({ id: "orphaned", params: { n: "3" } });
    // No transition ran: the navigation status never left IDLE.
    expect(stores.navigate.getState().status).toBe("IDLE");
  });

  it("does not adopt a same-id event (a nested router moving within our entry)", async () => {
    const { stores } = setup([root, { ...root, id: "shown", pathname: "/shown" }], 1);

    firePopState({
      id: "shown",
      index: 1,
      status: "PUSHING",
      params: {},
      transitionName: "cupertino",
      layoutId: null
    });
    await settle();

    expect(stores.history.getState().histories[1]!.pathname).toBe("/shown");
  });

  it("a task queued before disposal aborts instead of deadlocking the queue", async () => {
    // The zombie scenario: a traversal for router A queues behind an in-flight
    // transition; router A unmounts (sync disposed) before the task runs. The
    // task must abort on arrival — if it started a transition, no screen would
    // ever fire animationend and the SHARED queue would stall forever.
    const { stores, dispose } = setup([root, { ...root, id: "second", pathname: "/a" }], 1);

    // Block the queue with an unrelated manual task so the popstate task queues.
    let releaseBlocker!: () => void;
    const blockerDone = TaskManager.addTask(
      async () => {
        await new Promise<void>((resolve) => (releaseBlocker = resolve));
      },
      { control: { manual: false } }
    );

    // A back traversal arrives while blocked, then the router dies.
    firePopState({ id: "root", index: 0, status: "IDLE", params: {} });
    await new Promise((r) => setTimeout(r, 10));
    dispose();

    releaseBlocker();
    await blockerDone;
    await settle();

    // The dead router's stores were never touched...
    expect(stores.navigate.getState().status).toBe("IDLE");
    expect(stores.history.getState().index).toBe(1);

    // ...and the queue kept flowing: a later task runs normally.
    let ran = false;
    await TaskManager.addTask(async () => {
      ran = true;
    });
    await settle();
    expect(ran).toBe(true);
  });

  it("the disposer detaches the listener", async () => {
    const { stores, dispose } = setup();
    dispose();
    firePopState({ id: "a", index: 1, status: "PUSHING" });
    await settle();

    expect(stores.history.getState().index).toBe(0);
    expect(stores.history.getState().histories).toHaveLength(1);
  });
});
