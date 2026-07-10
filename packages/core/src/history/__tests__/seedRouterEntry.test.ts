import { beforeEach, describe, expect, it } from "vitest";

import createBrowserHistoryDriver from "@history/historyDriver";
import seedRouterEntry from "@history/seedRouterEntry";

const KEY = "_F_test_";

const seed = (overrides: Partial<Parameters<typeof seedRouterEntry>[0]> = {}) =>
  seedRouterEntry({
    driver: createBrowserHistoryDriver(KEY),
    routerKey: KEY,
    nested: true,
    seedPathname: "/playground/1",
    defaultTransitionName: "cupertino",
    rootParams: { n: "1" },
    ...overrides
  });

describe("seedRouterEntry", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("reflects a nested seed over its zone's bare parent entry", () => {
    // The host pushed the zone's bare path; the Router mounted /playground/1.
    window.history.replaceState(null, "", "/playground");
    seed();

    expect(window.location.pathname).toBe("/playground/1");
    expect((window.history.state as Record<string, unknown>)[KEY]).toMatchObject({
      id: "root",
      params: { n: "1" }
    });
  });

  it("never touches a FOREIGN entry — especially the root path", () => {
    // Under a storm this can run after the browser already backed to home.
    // Every pathname starts with "/", so the root must not pass the zone fence:
    // renaming the home entry to /playground/1 is the permanent URL↔content
    // mismatch this fence exists to prevent.
    window.history.replaceState(null, "", "/");
    seed();

    expect(window.location.pathname).toBe("/");
    expect((window.history.state as Record<string, unknown> | null)?.[KEY]).toBeUndefined();
  });

  it("never touches another zone's entry", () => {
    window.history.replaceState(null, "", "/docs/introduction");
    seed();

    expect(window.location.pathname).toBe("/docs/introduction");
    expect((window.history.state as Record<string, unknown> | null)?.[KEY]).toBeUndefined();
  });

  it("never renames an entry a previous incarnation already wrote to", () => {
    // The entry carries this Router's frame from an earlier life (a queued
    // forward moved the browser ahead before this remount's effect flushed):
    // reflecting the stale seed over it would corrupt it.
    window.history.replaceState({ [KEY]: { id: "p2", index: 2 } }, "", "/playground/2");
    seed({ seedPathname: "/playground/1" });

    expect(window.location.pathname).toBe("/playground/2");
  });

  it("a root Router seeds its frame without ever reflecting a URL", () => {
    window.history.replaceState(null, "", "/anywhere");
    seed({ nested: false, seedPathname: "/" });

    expect(window.location.pathname).toBe("/anywhere");
    expect((window.history.state as Record<string, unknown>)[KEY]).toMatchObject({ id: "root" });
  });
});
