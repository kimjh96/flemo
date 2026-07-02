import { describe, expect, it } from "vitest";

import createBrowserHistoryDriver from "@history/historyDriver";

describe("createBrowserHistoryDriver (keyless form)", () => {
  it("reads/writes the bare history state and reports traversals", async () => {
    const driver = createBrowserHistoryDriver();

    window.history.replaceState({ base: true }, "", "/base");
    expect(driver.readState()).toEqual({ base: true });
    expect(driver.readPathname()).toBe("/base");

    driver.pushState({ next: true }, "/next");
    expect(window.history.state).toEqual({ next: true });

    const events: unknown[] = [];
    const dispose = driver.subscribe((event) => events.push(event.state));

    const traversed = new Promise<void>((resolve) => {
      const handler = () => {
        window.removeEventListener("popstate", handler);
        resolve();
      };
      window.addEventListener("popstate", handler);
    });
    driver.back();
    await traversed;

    expect(events).toEqual([{ base: true }]);
    dispose();
  });
});

describe("createBrowserHistoryDriver (keyed form)", () => {
  it("namespaces its frame under the router key and traverses with go()", async () => {
    const driver = createBrowserHistoryDriver("r1");

    driver.replaceState({ mine: 1 }, "/keyed");
    expect((window.history.state as Record<string, unknown>).r1).toEqual({ mine: 1 });
    expect(driver.readState()).toEqual({ mine: 1 });

    driver.pushState({ mine: 2 }, "/keyed-2");
    expect(driver.readState()).toEqual({ mine: 2 });

    const traversed = new Promise<void>((resolve) => {
      const handler = () => {
        window.removeEventListener("popstate", handler);
        resolve();
      };
      window.addEventListener("popstate", handler);
    });
    driver.go(-1);
    await traversed;

    expect(driver.readState()).toEqual({ mine: 1 });
  });
});
