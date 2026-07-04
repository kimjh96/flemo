import { afterEach, beforeEach, describe, expect, it } from "vitest";

import TaskManager from "@core/TaskManger";

import createHistorySync from "@history/createHistorySync";
import type { HistoryDriver, HistoryNavEvent } from "@history/historyDriver";
import createHistoryStore from "@history/store";

import createNavigationController from "@navigate/createNavigationController";
import { createSelfPopGuard } from "@navigate/selfPopGuard";
import createNavigateStore from "@navigate/store";

import createTransitionStore from "@transition/store";

// Property test: whatever interleaving of browser traversals, in-app pushes,
// and Router remounts occurs, once the queue drains the store's top entry must
// match the browser's current entry, the stack must hold no duplicate ids, and
// the index must sit on the top. Runs against a simulated browser history (the
// exact History API semantics: push truncates the forward stack, traversals
// move a cursor and fire popstate with that entry's stored state).

interface ModelEntry {
  state: unknown;
  pathname: string;
}

const createBrowserModel = () => {
  const entries: ModelEntry[] = [{ state: null, pathname: "/" }];
  let cursor = 0;
  const listeners = new Set<(event: HistoryNavEvent) => void>();

  const fire = () => {
    const entry = entries[cursor]!;
    listeners.forEach((listener) =>
      listener({ state: entry.state, pathname: entry.pathname } as HistoryNavEvent)
    );
  };

  const driver: HistoryDriver = {
    readState: () => entries[cursor]!.state,
    readPathname: () => entries[cursor]!.pathname,
    pushState: (state, url) => {
      entries.splice(cursor + 1);
      entries.push({ state, pathname: url });
      cursor += 1;
    },
    replaceState: (state, url) => {
      entries[cursor] = { state, pathname: url };
    },
    go: (delta) => {
      const next = Math.min(entries.length - 1, Math.max(0, cursor + delta));
      if (next === cursor) return;
      cursor = next;
      fire();
    },
    back: () => driver.go(-1),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };

  return {
    driver,
    canBack: () => cursor > 0,
    canForward: () => cursor < entries.length - 1,
    back: () => driver.go(-1),
    forward: () => driver.go(1),
    current: () => entries[cursor]!,
    size: () => entries.length
  };
};

// A router bundle riding the model, wired exactly like a lone browser Router.
const mountRouter = (model: ReturnType<typeof createBrowserModel>) => {
  const guard = createSelfPopGuard();
  const seedStamp =
    ((model.current().state as { index?: number } | null)?.index as number | undefined) ?? 0;
  const life = { alive: true };
  const stores = {
    history: createHistoryStore(
      [
        {
          id: "root",
          pathname: model.current().pathname,
          params: {},
          transitionName: "none" as const,
          layoutId: null,
          frameIndex: seedStamp
        }
      ],
      0
    ),
    navigate: createNavigateStore(),
    transition: createTransitionStore("none"),
    life
  };
  // Seed the browser frame like ensureWindowHistoryState (bare, keyless).
  if (model.current().state === null) {
    model.driver.replaceState(
      {
        id: "root",
        index: 0,
        status: "IDLE",
        params: {},
        transitionName: "none",
        layoutId: null
      },
      model.current().pathname
    );
  }
  const controller = createNavigationController({
    stores,
    buildPathname: (path: string) => ({ pathname: path, toPathname: path }),
    driver: model.driver,
    markSelfInduced: guard.mark
  });
  const syncDispose = createHistorySync({ stores, driver: model.driver, consume: guard.consume });
  const dispose = () => {
    life.alive = false;
    syncDispose();
  };
  return { stores, controller, dispose };
};

// One drain window must exceed TaskManager's 100ms pending-poll, or a task
// merely WAITING its poll tick reads as "stable" and the settle loop breaks
// early (a flake under slow instrumentation like coverage).
const drain = async () => {
  for (let i = 0; i < 12; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await TaskManager.resolveAllPending();
  }
};

const lcg = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
};

describe("history convergence property", () => {
  let stopSweeper: (() => Promise<void>) | null = null;
  beforeEach(() => {
    let sweeping = true;
    const loop = (async () => {
      while (sweeping) {
        await new Promise((resolve) => setTimeout(resolve, 5));
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

  for (let seed = 1; seed <= 20; seed++) {
    it(`random walk converges (seed ${seed})`, { timeout: 30000 }, async () => {
      const rnd = lcg(seed);
      const model = createBrowserModel();
      let router = mountRouter(model);
      let pushCount = 0;
      const trace: string[] = [];

      for (let step = 0; step < 60; step++) {
        const roll = rnd();
        if (roll < 0.3 && model.canBack()) {
          trace.push("B");
          model.back();
        } else if (roll < 0.55 && model.canForward()) {
          trace.push("F");
          model.forward();
        } else if (roll < 0.9) {
          trace.push("N");
          pushCount += 1;
          void router.controller.push(`/p${pushCount}`).catch((error) => {
            throw error;
          });
        } else {
          // Remount: the Router dies mid-flight and a fresh one seeds from the
          // browser's current entry (the storm's cross-boundary case).
          trace.push("R");
          router.dispose();
          await drain();
          router = mountRouter(model);
        }
        // Sometimes act rapid-fire, sometimes let things settle.
        if (rnd() < 0.5) {
          await new Promise((resolve) => setTimeout(resolve, 3));
        } else {
          await drain();
        }
      }

      // Settle until the store stops changing (two identical consecutive
      // snapshots) — fixed drain counts are flaky when the whole suite loads
      // the shared queue.
      let previousSignature = "";
      let stableStreak = 0;
      for (let attempt = 0; attempt < 40 && stableStreak < 2; attempt++) {
        await drain();
        const signature = JSON.stringify(router.stores.history.getState().histories);
        stableStreak = signature === previousSignature ? stableStreak + 1 : 0;
        previousSignature = signature;
      }

      const { histories, index } = router.stores.history.getState();
      const failureContext = `seed ${seed} trace ${trace.join("")}`;

      // Invariant 1: no duplicate entries.
      const ids = histories.map((history) => history.id);
      expect(new Set(ids).size, `dup ids — ${failureContext}`).toBe(ids.length);

      // Invariant 2: the index sits on the top of the stack.
      expect(index, `index off top — ${failureContext}`).toBe(histories.length - 1);

      // Invariant 3: the store's top shows the browser's current PATHNAME —
      // the user-visible truth (screen == URL). Ids may legitimately differ
      // right after a remount reseed (the fresh seed is "root" while the
      // entry's frame keeps its original id); classification stays sound
      // because unknown ids adopt or re-push by identity on the next event.
      const currentFrame = model.current().state as { id?: string } | null;
      if (currentFrame?.id) {
        expect(histories[index]!.pathname, `pathname mismatch — ${failureContext}`).toBe(
          model.current().pathname
        );
      }

      // Invariant 4: the queue is alive — one more push lands.
      pushCount += 1;
      await router.controller.push(`/p${pushCount}`);
      for (let attempt = 0; attempt < 10; attempt++) {
        await drain();
        if (router.stores.history.getState().histories.at(-1)!.pathname === `/p${pushCount}`) break;
      }
      expect(
        router.stores.history.getState().histories.at(-1)!.pathname,
        `queue dead — ${failureContext}`
      ).toBe(`/p${pushCount}`);
    });
  }
});
