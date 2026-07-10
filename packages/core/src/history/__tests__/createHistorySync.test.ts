import { afterEach, beforeEach, describe, expect, it } from "vitest";

import TaskManager from "@core/TaskManger";

import createHistorySync, {
  ensureScopeHistorySync,
  releaseScopeHistorySync
} from "@history/createHistorySync";
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

// Every live sync stays subscribed to window popstate; without disposal each
// test's events would also fan out into all previous tests' syncs and stores.
const activeDisposers: (() => void)[] = [];

const setup = (histories: History[] = [root], index = 0) => {
  const stores = {
    history: createHistoryStore(histories, index),
    navigate: createNavigateStore()
  };
  const dispose = createHistorySync({ stores });
  activeDisposers.push(dispose);
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
  activeDisposers.splice(0).forEach((dispose) => dispose());
  await stopSweeper?.();
  stopSweeper = null;
});

// A real traversal lands the browser ON the entry before its popstate fires;
// the sync verifies the event still describes the present entry (stale queued
// events coalesce away), so the tests must move `history.state` the same way.
const firePopState = (state: Record<string, unknown>) => {
  window.history.replaceState(state, "", window.location.href);
  window.dispatchEvent(new PopStateEvent("popstate", { state }));
};

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

  it("a coalesced multi-step back replays EVERY intermediate screen (chained pops)", async () => {
    // Two rapid Back presses can reach the sync as a single -2 event. The pop
    // path must not drop the middle screen: it pops one level per transition
    // and re-drives the event until the target is reached.
    const a: History = { ...root, id: "a", pathname: "/a" };
    const bEntry: History = { ...root, id: "b", pathname: "/b" };
    const { stores, dispose } = setup([root, a, bEntry], 2);
    firePopState({ id: "root", index: 0, status: "POPPING" });
    await settle();
    await settle();

    expect(stores.history.getState().index).toBe(0);
    expect(stores.history.getState().histories).toHaveLength(1);
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

  it("REPRO: gap-jump then in-app push then single back must not duplicate entries", async () => {
    // The user's crash chain. Browser entries (written by a previous
    // incarnation): seed(0) p2(1) p3(2). A remounted router gap-jumps forward
    // to p3, pushes p4 in-app, then the user presses back once.
    const { stores } = setup([root], 0);

    // Forward gap-jump to p3 (browser index 2, we only have the seed).
    firePopState({
      id: "p3",
      index: 2,
      status: "PUSHING",
      params: {},
      transitionName: "cupertino",
      layoutId: null
    });
    await settle();

    // In-app push of p4 (controller writes store-index+1 = 2 → collides with p3's frame index).
    stores.history.getState().addHistory({
      id: "p4",
      pathname: "/p4",
      params: {},
      transitionName: "cupertino",
      layoutId: null
    });

    // Single browser back onto p3.
    firePopState({
      id: "p3",
      index: 2,
      status: "PUSHING",
      params: {},
      transitionName: "cupertino",
      layoutId: null
    });
    await settle();

    const { histories, index } = stores.history.getState();
    const ids = histories.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length); // ← 중복 없어야 함
    expect(histories[index]!.id).toBe("p3"); // ← 화면은 p3
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

  it("replays every queued traversal in order (late but complete)", async () => {
    const { stores } = setup(
      [root, { ...root, id: "b", pathname: "/b" }, { ...root, id: "c", pathname: "/c" }],
      2
    );

    // Block the queue so both traversals sit queued together.
    let releaseBlocker!: () => void;
    const blockerDone = TaskManager.addTask(
      async () => {
        await new Promise<void>((resolve) => (releaseBlocker = resolve));
      },
      { control: { manual: false } }
    );

    // Two rapid backs: c → b → root. BOTH materialize in order — the product
    // shows every defined transition even when it runs late (the user's call);
    // correctness under replay is guaranteed by identity-first classification,
    // converge-then-act, and the liveness guards, and proven by the
    // convergence property suite.
    firePopState({
      id: "b",
      index: 1,
      status: "PUSHING",
      params: {},
      transitionName: "cupertino",
      layoutId: null
    });
    firePopState({
      id: "root",
      index: 0,
      status: "IDLE",
      params: {},
      transitionName: "cupertino",
      layoutId: null
    });
    await new Promise((r) => setTimeout(r, 10));

    releaseBlocker();
    await blockerDone;
    // Two sequential manual gates + the 100ms pending-poll between them.
    for (let i = 0; i < 10; i++) {
      await settle();
      if (stores.history.getState().histories.at(-1)?.id === "root") break;
    }

    const { histories, index } = stores.history.getState();
    expect(histories[index]!.id).toBe("root");
    expect(index).toBe(0);
    expect(stores.navigate.getState().status).toBe("COMPLETED");
  });

  it("ignores an event arriving after disposal (pre-task)", async () => {
    const { stores, dispose } = setup([root, { ...root, id: "second", pathname: "/a" }], 1);
    dispose();

    firePopState({ id: "root", index: 0, status: "IDLE", params: {} });
    await settle();

    expect(stores.history.getState().index).toBe(1);
    expect(stores.navigate.getState().status).toBe("IDLE");
  });

  it("ignores an entry that carries no frame of ours (foreign territory)", async () => {
    const { stores } = setup([root, { ...root, id: "second", pathname: "/a" }], 1);

    window.history.replaceState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    await settle();

    expect(stores.history.getState().index).toBe(1);
    expect(stores.navigate.getState().status).toBe("IDLE");
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

// The convergence pass: when a storm leaves the store's active entry behind the
// address bar (the traversal's event was folded, or its gate was drained by the
// backstop) and NO further popstate will arrive, the sync itself must re-drive
// the browser's present entry until content and URL agree.
describe("createHistorySync convergence pass", () => {
  const mockDriver = (pathname: string, frame: object | null) => ({
    readState: () => frame,
    readPathname: () => pathname,
    pushState: () => {},
    replaceState: () => {},
    go: () => {},
    back: () => {},
    subscribe: () => () => {}
  });

  it("converges the store onto the browser's present entry once traversals go quiet", async () => {
    const stores = {
      history: createHistoryStore([root], 0),
      navigate: createNavigateStore()
    };
    // The browser sits on /p2 (a forward whose event was lost mid-storm); the
    // store still shows the root. No popstate will ever arrive.
    const dispose = createHistorySync({
      stores,
      driver: mockDriver("/p2", {
        id: "p2",
        index: 2,
        status: "PUSHING",
        params: {},
        transitionName: "cupertino",
        layoutId: null
      }),
      consume: () => false
    });
    activeDisposers.push(dispose);

    // Wait past the quiet window; the sweeper opens the animated forward's gate.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const { histories, index } = stores.history.getState();
    expect(histories[index]!.pathname).toBe("/p2");
    expect(histories[index]!.id).toBe("p2");
  }, 10000);

  it("never converges over a nested Router's sub-path (same-id live frame)", async () => {
    const shellEntry: History = { ...root, id: "shell", pathname: "/docs" };
    const stores = {
      history: createHistoryStore([shellEntry], 0),
      navigate: createNavigateStore()
    };
    // The URL moved to /docs/slot but the frame under OUR key is still the
    // shell's own entry — the sub-path belongs to a nested Router. A parent
    // that converged over it would tear the nested Router down.
    const dispose = createHistorySync({
      stores,
      driver: mockDriver("/docs/slot", {
        id: "shell",
        index: 0,
        status: "PUSHING",
        params: {},
        transitionName: "cupertino",
        layoutId: null
      }),
      consume: () => false
    });
    activeDisposers.push(dispose);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const { histories, index } = stores.history.getState();
    expect(histories[index]!.pathname).toBe("/docs");
    expect(histories).toHaveLength(1);
  }, 10000);
});

// Offscreen zones (life.alive=false: frozen by the host, or torn down between
// zone visits) still hear traversals but apply them INSTANTLY — nothing is
// visible to animate and no animationend can arrive — so the zone is already
// on the right entry whenever it is revealed.
describe("createHistorySync offscreen (life.alive=false)", () => {
  const emittingDriver = (pathname: () => string) => {
    let listener: ((event: { state: unknown; pathname: string }) => unknown) | null = null;
    return {
      driver: {
        readState: () => null,
        readPathname: pathname,
        pushState: () => {},
        replaceState: () => {},
        go: () => {},
        back: () => {},
        subscribe: (l: (event: { state: unknown; pathname: string }) => unknown) => {
          listener = l;
          return () => {
            listener = null;
          };
        }
      },
      emit: (state: unknown, eventPathname: string) =>
        listener?.({ state, pathname: eventPathname })
    };
  };

  it("applies a forward into an unheld entry instantly, with no transition", async () => {
    const stores = { history: createHistoryStore([root], 0), navigate: createNavigateStore() };
    const { driver, emit } = emittingDriver(() => "/p2");
    const dispose = createHistorySync({
      stores,
      driver,
      consume: () => false,
      life: { alive: false }
    });
    activeDisposers.push(dispose);

    emit(
      {
        id: "p2",
        index: 2,
        status: "PUSHING",
        params: {},
        transitionName: "cupertino",
        layoutId: null
      },
      "/p2"
    );
    // The offscreen apply first waits ALIVE_SETTLE_MS to re-check liveness.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const { histories, index, pendingIndex } = stores.history.getState();
    expect(histories[index]!.id).toBe("p2");
    expect(pendingIndex).toBe(index);
    expect(stores.navigate.getState().status).toBe("IDLE"); // no transition ran
  });

  it("applies a pop to a held entry instantly (truncates straight to the target)", async () => {
    const held: History[] = [
      root,
      { ...root, id: "a", pathname: "/a" },
      { ...root, id: "b", pathname: "/b" }
    ];
    const stores = { history: createHistoryStore(held, 2), navigate: createNavigateStore() };
    const { driver, emit } = emittingDriver(() => "/");
    const dispose = createHistorySync({
      stores,
      driver,
      consume: () => false,
      life: { alive: false }
    });
    activeDisposers.push(dispose);

    emit(
      {
        id: "root",
        index: 0,
        status: "PUSHING",
        params: {},
        transitionName: "cupertino",
        layoutId: null
      },
      "/"
    );
    // The offscreen apply first waits ALIVE_SETTLE_MS to re-check liveness.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const { histories, index } = stores.history.getState();
    expect(index).toBe(0);
    expect(histories).toHaveLength(1);
    expect(stores.navigate.getState().status).toBe("IDLE");
  });
});

// The per-scope sync lifetime policy: one live sync per scope; a persistent
// scope's sync survives its binding's unmount (the zone keeps hearing
// traversals while offscreen); a non-persistent (root) scope's does not.
describe("ensureScopeHistorySync / releaseScopeHistorySync", () => {
  const scopeWith = (persistent: boolean) => {
    let subscribes = 0;
    let disposals = 0;
    const scope = {
      history: createHistoryStore([root], 0),
      navigate: createNavigateStore(),
      driver: {
        readState: () => null,
        readPathname: () => "/",
        pushState: () => {},
        replaceState: () => {},
        go: () => {},
        back: () => {},
        subscribe: () => {
          subscribes += 1;
          return () => {
            disposals += 1;
          };
        }
      },
      consume: () => false,
      persistent,
      life: { alive: true }
    };
    return { scope, counts: () => ({ subscribes, disposals }) };
  };

  it("creates one sync per scope, however many times ensure runs", () => {
    const { scope, counts } = scopeWith(false);
    ensureScopeHistorySync(scope);
    ensureScopeHistorySync(scope);
    expect(counts().subscribes).toBe(1);
    releaseScopeHistorySync(scope);
  });

  it("keeps a persistent scope's sync across release; disposes a plain one", () => {
    const persistentScope = scopeWith(true);
    ensureScopeHistorySync(persistentScope.scope);
    releaseScopeHistorySync(persistentScope.scope);
    expect(persistentScope.counts().disposals).toBe(0);

    const plain = scopeWith(false);
    ensureScopeHistorySync(plain.scope);
    releaseScopeHistorySync(plain.scope);
    expect(plain.counts().disposals).toBe(1);
  });
});
