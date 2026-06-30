import { beforeEach, describe, expect, it } from "vitest";

import type { HistoryNavEvent } from "@history/historyDriver";
import createMemoryHistoryDriver from "@history/memoryHistoryDriver";

// `go` / `back` fire on a microtask, so flush once after each traversal.
const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe("createMemoryHistoryDriver", () => {
  let events: HistoryNavEvent[];

  beforeEach(() => {
    events = [];
  });

  it("seeds a root entry from the initial state/url and does not fire on push", () => {
    const driver = createMemoryHistoryDriver({ state: { id: "root" }, url: "/home" });
    driver.subscribe((event) => events.push(event));

    driver.pushState({ id: "a" }, "/library");

    // pushState mutates the stack but never fires a popstate-equivalent.
    expect(events).toHaveLength(0);
  });

  it("fires the destination entry's state + pathname on back()", async () => {
    const driver = createMemoryHistoryDriver({ state: { id: "root" }, url: "/home" });
    driver.subscribe((event) => events.push(event));

    driver.pushState({ id: "a" }, "/library");
    driver.back();
    await tick();

    expect(events).toEqual([{ state: { id: "root" }, pathname: "/home" }]);
  });

  it("fires on go(delta) toward the target entry", async () => {
    const driver = createMemoryHistoryDriver({ state: { id: "root" }, url: "/home" });
    driver.pushState({ id: "a" }, "/a");
    driver.pushState({ id: "b" }, "/b");
    driver.subscribe((event) => events.push(event));

    driver.go(-2);
    await tick();

    expect(events).toEqual([{ state: { id: "root" }, pathname: "/home" }]);
  });

  it("does not fire when go() makes no move (delta 0 or out of bounds)", async () => {
    const driver = createMemoryHistoryDriver({ url: "/home" });
    driver.subscribe((event) => events.push(event));

    driver.go(0);
    driver.go(-5); // already at root, clamped → no move
    driver.pushState({ id: "a" }, "/a");
    driver.go(5); // past the end, clamped → no move
    await tick();

    expect(events).toEqual([]);
  });

  it("does not fire when back() is at the root", async () => {
    const driver = createMemoryHistoryDriver({ url: "/home" });
    driver.subscribe((event) => events.push(event));

    driver.back();
    await tick();

    expect(events).toEqual([]);
  });

  it("truncates the forward stack on push (no forward entry to go to)", async () => {
    const driver = createMemoryHistoryDriver({ state: { id: "root" }, url: "/home" });
    driver.pushState({ id: "a" }, "/a");
    driver.back(); // back to root, /a is now forward
    await tick();

    driver.pushState({ id: "b" }, "/b"); // truncates /a
    driver.subscribe((event) => events.push(event));

    driver.go(1); // nothing forward of /b → no move
    await tick();

    expect(events).toEqual([]);
  });

  it("replaceState overwrites the current entry in place", async () => {
    const driver = createMemoryHistoryDriver({ state: { id: "root" }, url: "/home" });
    driver.pushState({ id: "a" }, "/a");
    driver.replaceState({ id: "a2" }, "/a2");
    driver.subscribe((event) => events.push(event));

    driver.back();
    await tick();
    expect(events).toEqual([{ state: { id: "root" }, pathname: "/home" }]);

    driver.go(1); // forward to the replaced entry
    await tick();
    expect(events[1]).toEqual({ state: { id: "a2" }, pathname: "/a2" });
  });

  it("stops delivering after the subscriber disposes", async () => {
    const driver = createMemoryHistoryDriver({ url: "/home" });
    driver.pushState({ id: "a" }, "/a");
    const dispose = driver.subscribe((event) => events.push(event));

    dispose();
    driver.back();
    await tick();

    expect(events).toEqual([]);
  });

  it("defaults the seed to null state at '/'", async () => {
    const driver = createMemoryHistoryDriver();
    driver.pushState({ id: "a" }, "/a");
    driver.subscribe((event) => events.push(event));

    driver.back();
    await tick();

    expect(events).toEqual([{ state: null, pathname: "/" }]);
  });

  it("readState returns the current entry's state", () => {
    const driver = createMemoryHistoryDriver({ state: { id: "root" }, url: "/" });
    expect(driver.readState()).toEqual({ id: "root" });

    driver.pushState({ id: "a" }, "/a");
    expect(driver.readState()).toEqual({ id: "a" });

    driver.back();
    expect(driver.readState()).toEqual({ id: "root" });
  });
});
