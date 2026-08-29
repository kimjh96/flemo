import { describe, expect, it, vi } from "vitest";

import createRouterScope, { type FlemoStores } from "@core/createRouterScope";

import type { HistoryDriver } from "@history/historyDriver";
import createHistoryStore from "@history/store";

import createNavigateStore from "@navigate/store";

import createTransitionStore from "@transition/store";

import createScreenStore from "@screen/store";

const fakeBrowserDriver = (): HistoryDriver => ({
  readState: () => null,
  readPathname: () => "/",
  pushState: vi.fn(),
  replaceState: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  subscribe: () => () => {}
});

const baseInput = {
  routePaths: ["/", "/posts/:id"],
  pathname: "/posts/42",
  search: "",
  defaultTransitionName: "cupertino" as const,
  memory: false,
  hostedScope: null
};

describe("createRouterScope", () => {
  it("seeds a browser scope from the pathname with its own self-pop guard", () => {
    const browserDriver = fakeBrowserDriver();
    const scope = createRouterScope({ ...baseInput, browserDriver });

    const { histories, index } = scope.history.getState();
    expect(index).toBe(0);
    expect(histories[0].pathname).toBe("/posts/42");
    expect(histories[0].params).toEqual({ id: "42" });
    expect(scope.driver).toBe(browserDriver);
    expect(scope.transition.getState().defaultTransitionName).toBe("cupertino");

    // A real guard: a marked traversal is consumed exactly once.
    expect(scope.consume()).toBe(false);
    scope.markSelfInduced();
    expect(scope.consume()).toBe(true);
    expect(scope.consume()).toBe(false);
  });

  it("gives each browser scope an independent guard", () => {
    const first = createRouterScope({ ...baseInput, browserDriver: fakeBrowserDriver() });
    const second = createRouterScope({ ...baseInput, browserDriver: fakeBrowserDriver() });

    first.markSelfInduced();
    expect(second.consume()).toBe(false);
    expect(first.consume()).toBe(true);
  });

  it("builds a memory scope with a seeded in-memory driver and a real guard", () => {
    const scope = createRouterScope({ ...baseInput, memory: true, browserDriver: null });

    expect(scope.driver.readPathname()).toBe("/posts/42");
    const frame = scope.driver.readState() as { params?: object } | null;
    expect(frame?.params).toEqual({ id: "42" });
    expect(scope.memory).toBe(true);

    // A memory scope mounts the history sync too, so its own traversals have to
    // be balanced exactly as a browser scope's are — a no-op guard here would
    // let the navigation queue's `back()` come back around and pop twice.
    expect(scope.consume()).toBe(false);
    scope.markSelfInduced();
    expect(scope.consume()).toBe(true);
    expect(scope.consume()).toBe(false);
  });

  it("adopts a hosted scope, seeding its empty history exactly once", () => {
    const hostedScope: FlemoStores = {
      history: createHistoryStore(),
      navigate: createNavigateStore(),
      transition: createTransitionStore(),
      screen: createScreenStore(),
      driver: fakeBrowserDriver(),
      memory: false,
      markSelfInduced: () => {},
      consume: () => false,
      life: { alive: true }
    };
    expect(hostedScope.history.getState().index).toBe(-1);

    const adopted = createRouterScope({ ...baseInput, browserDriver: null, hostedScope });

    expect(adopted).toBe(hostedScope);
    expect(adopted.history.getState().index).toBe(0);
    expect(adopted.history.getState().histories[0].pathname).toBe("/posts/42");

    // Already seeded: a re-adoption leaves the stack alone.
    adopted.history.setState({ index: 1 });
    const readopted = createRouterScope({ ...baseInput, browserDriver: null, hostedScope });
    expect(readopted.history.getState().index).toBe(1);
  });
});

describe("createRouterScope persistence (persistKey)", () => {
  it("a re-created Router resumes its previous incarnation's scope, brought to rest", () => {
    const browserDriver = fakeBrowserDriver();
    const key = `persist-${Math.random().toString(36).slice(2)}`;
    const first = createRouterScope({ ...baseInput, browserDriver, persistKey: key });
    expect(first.persistent).toBe(true);

    // The zone lives on: entries pushed, then destroyed mid-transition.
    first.history.getState().addHistory({
      id: "deep",
      pathname: "/posts/9",
      params: { id: "9" },
      transitionName: "cupertino"
    });
    first.navigate.getState().setStatus("POPPING");
    first.life.alive = false;

    // A zone re-entry re-creates the Router — the SAME scope comes back,
    // stack intact, sanitized to rest.
    const second = createRouterScope({ ...baseInput, browserDriver, persistKey: key });
    expect(second).toBe(first);
    expect(second.history.getState().histories).toHaveLength(2);
    expect(second.navigate.getState().status).toBe("IDLE");
    expect(second.life.alive).toBe(true);
    expect(second.history.getState().pendingIndex).toBe(second.history.getState().index);
  });

  it("scopes with different keys stay isolated", () => {
    const a = createRouterScope({
      ...baseInput,
      browserDriver: fakeBrowserDriver(),
      persistKey: "iso-a"
    });
    const b = createRouterScope({
      ...baseInput,
      browserDriver: fakeBrowserDriver(),
      persistKey: "iso-b"
    });
    expect(a).not.toBe(b);
  });
});
