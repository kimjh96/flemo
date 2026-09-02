import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BROWSER_HISTORY_LANE } from "@core/TaskManger";

import createBrowserHistoryDriver, {
  type HistoryDriver,
  type HistoryNavEvent,
  navigationLane
} from "@history/historyDriver";
import createMemoryHistoryDriver from "@history/memoryHistoryDriver";

// The keyed browser driver namespaces its frame under a routerKey so multiple
// browser Routers can share `window.history.state` without clobbering. These run
// against jsdom's real window.history.

const resetWindowState = () => {
  window.history.replaceState(null, "", "/");
};

beforeEach(resetWindowState);
afterEach(resetWindowState);

describe("createBrowserHistoryDriver (keyless)", () => {
  it("stores the frame bare as the whole history.state", () => {
    const driver = createBrowserHistoryDriver();
    driver.pushState({ id: "a", index: 1 }, "/a");

    expect(window.history.state).toEqual({ id: "a", index: 1 });
  });

  it("delivers the bare state to a subscriber on popstate", () => {
    const driver = createBrowserHistoryDriver();
    const events: HistoryNavEvent[] = [];
    const dispose = driver.subscribe((event) => events.push(event));

    window.dispatchEvent(new PopStateEvent("popstate", { state: { id: "z", index: 0 } }));

    expect(events).toHaveLength(1);
    expect(events[0].state).toEqual({ id: "z", index: 0 });
    dispose();
  });
});

describe("createBrowserHistoryDriver (keyed)", () => {
  it("namespaces the frame under the routerKey", () => {
    const driver = createBrowserHistoryDriver("docs");
    driver.pushState({ id: "a", index: 1 }, "/a");

    expect(window.history.state).toEqual({ docs: { id: "a", index: 1 } });
  });

  it("merges into the current state on replaceState, preserving other keys", () => {
    window.history.replaceState({ shell: { id: "s", index: 4 } }, "", "/");
    const driver = createBrowserHistoryDriver("docs");
    driver.replaceState({ id: "a", index: 1 }, "/a");

    expect(window.history.state).toEqual({
      shell: { id: "s", index: 4 },
      docs: { id: "a", index: 1 }
    });
  });

  it("subscribe extracts only this Router's key from the event state", () => {
    const driver = createBrowserHistoryDriver("docs");
    const events: HistoryNavEvent[] = [];
    const dispose = driver.subscribe((event) => events.push(event));

    window.dispatchEvent(
      new PopStateEvent("popstate", {
        state: { shell: { id: "s", index: 2 }, docs: { id: "d", index: 1 } }
      })
    );

    expect(events[0].state).toEqual({ id: "d", index: 1 });
    dispose();
  });

  it("subscribe yields null when the event state lacks this Router's key", () => {
    const driver = createBrowserHistoryDriver("docs");
    const events: HistoryNavEvent[] = [];
    const dispose = driver.subscribe((event) => events.push(event));

    window.dispatchEvent(
      new PopStateEvent("popstate", { state: { shell: { id: "s", index: 2 } } })
    );

    expect(events[0].state).toBeNull();
    dispose();
  });

  it("two keyed drivers do not clobber each other's frame in the same entry", () => {
    const shell = createBrowserHistoryDriver("shell");
    const docs = createBrowserHistoryDriver("docs");

    shell.replaceState({ id: "shell-root", index: 0 }, "/");
    docs.replaceState({ id: "docs-root", index: 0 }, "/");
    shell.pushState({ id: "shell-a", index: 1 }, "/a");

    // The single entry now carries both keys; each driver reads back its own.
    const shellEvents: HistoryNavEvent[] = [];
    const docsEvents: HistoryNavEvent[] = [];
    const disposeShell = shell.subscribe((event) => shellEvents.push(event));
    const disposeDocs = docs.subscribe((event) => docsEvents.push(event));

    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));

    expect(shellEvents[0].state).toEqual({ id: "shell-a", index: 1 });
    expect(docsEvents[0].state).toEqual({ id: "docs-root", index: 0 });
    disposeShell();
    disposeDocs();
  });
});

describe("createBrowserHistoryDriver (traversal)", () => {
  it("go and back delegate to window.history without throwing", () => {
    const driver = createBrowserHistoryDriver();
    driver.pushState({ id: "a", index: 1 }, "/a");
    driver.pushState({ id: "b", index: 2 }, "/b");

    expect(() => driver.back()).not.toThrow();
    expect(() => driver.go(-1)).not.toThrow();
  });

  it("a keyed driver's go and back delegate too", () => {
    const driver = createBrowserHistoryDriver("shell");
    driver.pushState({ id: "a", index: 1 }, "/a");
    driver.pushState({ id: "b", index: 2 }, "/b");

    expect(() => driver.back()).not.toThrow();
    expect(() => driver.go(-1)).not.toThrow();
  });
});

describe("createBrowserHistoryDriver (real jsdom traversal)", () => {
  // Unlike the synthetic PopStateEvent suites above, these traverse jsdom's
  // real history stack, so the popstate the driver reports carries the state
  // the browser restored — the round trip the synthetic events can't prove.
  const nextPopstate = () =>
    new Promise<void>((resolve) => {
      const handler = () => {
        window.removeEventListener("popstate", handler);
        resolve();
      };
      window.addEventListener("popstate", handler);
    });

  it("keyless: reads/writes the bare history state and reports traversals", async () => {
    const driver = createBrowserHistoryDriver();

    window.history.replaceState({ base: true }, "", "/base");
    expect(driver.readState()).toEqual({ base: true });
    expect(driver.readPathname()).toBe("/base");

    driver.pushState({ next: true }, "/next");
    expect(window.history.state).toEqual({ next: true });

    const events: unknown[] = [];
    const dispose = driver.subscribe((event) => events.push(event.state));

    const traversed = nextPopstate();
    driver.back();
    await traversed;

    expect(events).toEqual([{ base: true }]);
    dispose();
  });

  it("keyed: namespaces its frame under the router key and traverses with go()", async () => {
    const driver = createBrowserHistoryDriver("r1");

    driver.replaceState({ mine: 1 }, "/keyed");
    expect((window.history.state as Record<string, unknown>).r1).toEqual({ mine: 1 });
    expect(driver.readState()).toEqual({ mine: 1 });

    driver.pushState({ mine: 2 }, "/keyed-2");
    expect(driver.readState()).toEqual({ mine: 2 });

    const traversed = nextPopstate();
    driver.go(-1);
    await traversed;

    expect(driver.readState()).toEqual({ mine: 1 });
  });
});

describe("createBrowserHistoryDriver (readState)", () => {
  it("keyless reads the whole history.state back", () => {
    const driver = createBrowserHistoryDriver();
    driver.replaceState({ id: "a", index: 0 }, "/a");

    expect(driver.readState()).toEqual({ id: "a", index: 0 });
  });

  it("keyed reads only its own frame, ignoring a sibling's", () => {
    const shell = createBrowserHistoryDriver("shell");
    const docs = createBrowserHistoryDriver("docs");

    shell.replaceState({ id: "shell-root", index: 0 }, "/");
    docs.replaceState({ id: "docs-root", index: 3 }, "/");

    expect(shell.readState()).toEqual({ id: "shell-root", index: 0 });
    expect(docs.readState()).toEqual({ id: "docs-root", index: 3 });
  });
});

// The serial lane a driver's navigations take their turn in. Everything on the
// browser's own history shares one lane, exactly as before; a driver with a
// stack of its own gets a lane nobody else waits on.
describe("navigationLane", () => {
  it("puts every driver that shares window.history in the one browser lane", () => {
    expect(navigationLane(createBrowserHistoryDriver())).toBe(BROWSER_HISTORY_LANE);
    expect(navigationLane(createBrowserHistoryDriver("shell"))).toBe(BROWSER_HISTORY_LANE);
    expect(navigationLane(createBrowserHistoryDriver("docs"))).toBe(BROWSER_HISTORY_LANE);
  });

  it("gives an isolated driver a lane of its own", () => {
    const lane = navigationLane(createMemoryHistoryDriver());

    expect(lane).not.toBe(BROWSER_HISTORY_LANE);
  });

  it("returns the same lane for the same driver every time", () => {
    // A Router builds one driver and hands it to its navigation, step and sync
    // controllers, which all mutate the one stack and so must share a lane.
    const driver = createMemoryHistoryDriver();

    expect(navigationLane(driver)).toBe(navigationLane(driver));
  });

  it("does not put two isolated drivers in the same lane", () => {
    // Two memory Routers on a page (the landing's looping mockups) own separate
    // stacks, so neither has a turn to take behind the other.
    const first = createMemoryHistoryDriver();
    const second = createMemoryHistoryDriver();

    expect(navigationLane(first)).not.toBe(navigationLane(second));
  });

  it("reads isolation off the driver, not off its construction", () => {
    // Any driver may declare its own stack; the memory driver is only the one
    // shipped that does.
    const isolated: HistoryDriver = { ...createBrowserHistoryDriver(), isolated: true };

    expect(navigationLane(isolated)).not.toBe(BROWSER_HISTORY_LANE);
  });
});
