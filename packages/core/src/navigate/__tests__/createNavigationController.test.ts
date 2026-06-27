import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("a navigation is ignored while a transition is mid-flight", async () => {
    const { stores, controller } = setup();
    stores.navigate.getState().setStatus("PUSHING");
    await controller.push("/a");
    expect(stores.history.getState().index).toBe(0);
    expect(stores.history.getState().histories).toHaveLength(1);
  });
});

// Build [root, /a, /b] (index 2) with plain pushes, then exercise the collapse
// paths (skip / until distance options) that stack on, replace through, or pop
// over the screens between the top and a target below it.
const buildStack = async (controller: ReturnType<typeof setup>["controller"]) => {
  await controller.push("/a");
  await controller.push("/b");
};

describe("createNavigationController distance options (skip / until / collapse)", () => {
  it("push { skip } collapses the skipped screen under the new top", async () => {
    const { stores, controller } = setup();
    await buildStack(controller);
    await controller.push("/c", {}, { skip: 1 });
    expect(stores.history.getState().histories.at(-1)?.pathname).toBe("/c");
    expect(stores.history.getState().histories).toHaveLength(3); // one screen collapsed away
    expect(stores.navigate.getState().status).toBe("COMPLETED");
  });

  it("push { until } collapses back to the matched screen and stacks on it", async () => {
    const { stores, controller } = setup();
    await buildStack(controller);
    await controller.push("/c", {}, { until: "/" });
    expect(stores.history.getState().histories.map((h) => h.pathname)).toEqual(["/", "/c"]);
    expect(stores.navigate.getState().status).toBe("COMPLETED");
  });

  it("push { until } with no match falls back to a plain push", async () => {
    const { stores, controller } = setup();
    await buildStack(controller);
    await controller.push("/c", {}, { until: "/nope" });
    expect(stores.history.getState().histories).toHaveLength(4); // nothing collapsed
    expect(stores.history.getState().histories.at(-1)?.pathname).toBe("/c");
  });

  it("replace { skip } collapses through to the target", async () => {
    const { stores, controller } = setup();
    await buildStack(controller);
    await controller.replace("/c", {}, { skip: 1 });
    expect(stores.history.getState().histories.at(-1)?.pathname).toBe("/c");
    expect(stores.history.getState().histories.length).toBeLessThan(3);
    expect(stores.navigate.getState().status).toBe("COMPLETED");
  });

  it("replace { until } to the root collapses the whole stack", async () => {
    const { stores, controller } = setup();
    await buildStack(controller);
    await controller.replace("/c", {}, { until: "/" });
    expect(stores.history.getState().histories.at(-1)?.pathname).toBe("/c");
    expect(stores.history.getState().index).toBe(0);
    expect(stores.navigate.getState().status).toBe("COMPLETED");
  });

  it("pop { skip } pops several screens at once", async () => {
    const { stores, controller } = setup();
    await buildStack(controller);
    await controller.pop({ skip: 2 });
    expect(stores.history.getState().index).toBe(0);
    expect(stores.history.getState().histories.at(-1)?.pathname).toBe("/");
    expect(stores.navigate.getState().status).toBe("COMPLETED");
  });

  it("pop { until } pops back to the matched screen", async () => {
    const { stores, controller } = setup();
    await buildStack(controller);
    await controller.pop({ until: "/" });
    expect(stores.history.getState().index).toBe(0);
    expect(stores.history.getState().histories.at(-1)?.pathname).toBe("/");
  });

  it("pop { until } with no match is a no-op", async () => {
    const { stores, controller } = setup();
    await buildStack(controller);
    const before = stores.history.getState().index;
    await controller.pop({ until: "/nope" });
    expect(stores.history.getState().index).toBe(before);
  });

  it("pop relabels the leaving top with the override transitionName", async () => {
    const { stores, controller } = setup();
    await buildStack(controller);
    await controller.pop({ transitionName: "material" });
    expect(stores.history.getState().histories.at(-1)?.pathname).toBe("/a");
    expect(stores.navigate.getState().status).toBe("COMPLETED");
  });

  it("pop at the root is a no-op", async () => {
    const { stores, controller } = setup();
    await controller.pop();
    expect(stores.history.getState().index).toBe(0);
    expect(stores.history.getState().histories).toHaveLength(1);
  });

  it("pop { skip } past the root clamps to the root", async () => {
    const { stores, controller } = setup();
    await buildStack(controller);
    await controller.pop({ skip: 99 });
    expect(stores.history.getState().index).toBe(0);
  });

  it("pop { skip: 0 } is a no-op", async () => {
    const { stores, controller } = setup();
    await buildStack(controller);
    const before = stores.history.getState().index;
    await controller.pop({ skip: 0 });
    expect(stores.history.getState().index).toBe(before);
  });

  it("replace is ignored while a transition is mid-flight", async () => {
    const { stores, controller } = setup();
    stores.navigate.getState().setStatus("REPLACING");
    await controller.replace("/a");
    expect(stores.history.getState().histories).toHaveLength(1);
  });

  it("replace { until } with no match is a no-op", async () => {
    const { stores, controller } = setup();
    await buildStack(controller);
    const before = stores.history.getState().histories.length;
    await controller.replace("/c", {}, { until: "/nope" });
    expect(stores.history.getState().histories).toHaveLength(before);
  });

  it("a collapse whose popstate never fires still settles via the timeout fallback", async () => {
    const { stores, controller } = setup();
    await buildStack(controller);
    // Suppress the browser pop so syncCollapsedHistory's popstate never arrives
    // and it falls through to the 200ms safety timeout instead of committing.
    const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    await controller.push("/c", {}, { until: "/" });
    go.mockRestore();
    expect(stores.history.getState().histories.at(-1)?.pathname).toBe("/c");
    expect(stores.navigate.getState().status).toBe("COMPLETED");
  });
});
