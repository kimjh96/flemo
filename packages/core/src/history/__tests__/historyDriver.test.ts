import { afterEach, beforeEach, describe, expect, it } from "vitest";

import createBrowserHistoryDriver, { type HistoryNavEvent } from "@history/historyDriver";

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
