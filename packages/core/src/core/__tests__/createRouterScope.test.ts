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

  it("builds a memory scope with a seeded in-memory driver and a no-op guard", () => {
    const scope = createRouterScope({ ...baseInput, memory: true, browserDriver: null });

    expect(scope.driver.readPathname()).toBe("/posts/42");
    const frame = scope.driver.readState() as { params?: object } | null;
    expect(frame?.params).toEqual({ id: "42" });

    // No-op guard: marking never makes consume report true.
    scope.markSelfInduced();
    expect(scope.consume()).toBe(false);
  });

  it("adopts a hosted scope, seeding its empty history exactly once", () => {
    const hostedScope: FlemoStores = {
      history: createHistoryStore(),
      navigate: createNavigateStore(),
      transition: createTransitionStore(),
      screen: createScreenStore(),
      driver: fakeBrowserDriver(),
      markSelfInduced: () => {},
      consume: () => false
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
