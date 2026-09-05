import { afterEach, beforeEach, describe, expect, it } from "vitest";

import createRouterScope, { adoptEntryIdentity } from "@core/createRouterScope";

import createBrowserHistoryDriver from "@history/historyDriver";

// THE FIRST CLIENT RENDER HAS TO BE THE SERVER'S RENDER.
//
// A Router adopts the identity of the browser entry it mounted on so that a
// traversal back onto that entry matches by id rather than colliding with every
// other scope's generic "root". The adoption reads `window.history.state`,
// which the server cannot see, and it ran inside the store initializer — the
// one render that must agree with the server HTML.
//
// `history.state` survives a reload, so a refresh on a page that had pushed
// seeded a generated id where the server had written "root":
//
//   + data-flemo-screen="1788648834008-1788648872620-ccjmp40m9"   (client)
//   - data-flemo-screen="root"                                     (server)
//
// React does not patch a mismatched attribute, so the DOM kept "root" while the
// store believed the other one — the engine and the document disagreeing about
// which screen this is, for the life of the page. Reported from the browser as
// a console error after refreshing the home page; reproduced by navigating out
// of a nested Router's zone and back before reloading.

const ROUTER_KEY = "test-router";
const RESTORED = "1788648834008-1788648872620-ccjmp40m9";

const seedRestoredEntry = (over: Record<string, unknown> = {}) => {
  window.history.replaceState(
    { [ROUTER_KEY]: { id: RESTORED, index: 2, status: "IDLE", params: { a: "1" }, ...over } },
    "",
    "/"
  );
};

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("the entry-identity adoption", () => {
  it("takes the entry's id at construction when nothing defers it", () => {
    seedRestoredEntry();
    const scope = createRouterScope({
      routePaths: ["/"],
      pathname: "/",
      search: "",
      defaultTransitionName: "none",
      memory: false,
      browserDriver: createBrowserHistoryDriver(ROUTER_KEY),
      hostedScope: null,
      routerKey: ROUTER_KEY
    });
    expect(scope.history.getState().histories[0].id).toBe(RESTORED);
  });

  it("seeds the server's own root when the adoption is deferred", () => {
    seedRestoredEntry();
    const scope = createRouterScope({
      routePaths: ["/"],
      pathname: "/",
      search: "",
      defaultTransitionName: "none",
      memory: false,
      browserDriver: createBrowserHistoryDriver(ROUTER_KEY),
      hostedScope: null,
      routerKey: ROUTER_KEY,
      deferEntryAdoption: true
    });
    expect(scope.history.getState().histories[0].id).toBe("root");
  });

  it("still takes the identity when the deferred adoption runs", () => {
    seedRestoredEntry();
    const scope = createRouterScope({
      routePaths: ["/"],
      pathname: "/",
      search: "",
      defaultTransitionName: "none",
      memory: false,
      browserDriver: createBrowserHistoryDriver(ROUTER_KEY),
      hostedScope: null,
      routerKey: ROUTER_KEY,
      deferEntryAdoption: true
    });

    adoptEntryIdentity(scope);

    const seed = scope.history.getState().histories[0];
    expect(seed.id).toBe(RESTORED);
    // The entry's params and its place in browser space come with the id, the
    // same three fields the construction path takes.
    expect(seed.params).toEqual({ a: "1" });
    expect(seed.frameIndex).toBe(2);
  });

  it("is idempotent, which a strict-mode double effect needs it to be", () => {
    seedRestoredEntry();
    const scope = createRouterScope({
      routePaths: ["/"],
      pathname: "/",
      search: "",
      defaultTransitionName: "none",
      memory: false,
      browserDriver: createBrowserHistoryDriver(ROUTER_KEY),
      hostedScope: null,
      routerKey: ROUTER_KEY,
      deferEntryAdoption: true
    });
    adoptEntryIdentity(scope);
    adoptEntryIdentity(scope);
    expect(scope.history.getState().histories[0].id).toBe(RESTORED);
    expect(scope.history.getState().histories).toHaveLength(1);
  });

  it("refuses an entry with no frame of its own", () => {
    const scope = createRouterScope({
      routePaths: ["/"],
      pathname: "/",
      search: "",
      defaultTransitionName: "none",
      memory: false,
      browserDriver: createBrowserHistoryDriver(ROUTER_KEY),
      hostedScope: null,
      routerKey: ROUTER_KEY,
      deferEntryAdoption: true
    });
    adoptEntryIdentity(scope);
    expect(scope.history.getState().histories[0].id).toBe("root");
  });

  // Renaming the first frame of a stack that has moved on would rename an entry
  // the user has since left.
  it("refuses a scope that has already navigated", () => {
    seedRestoredEntry();
    const scope = createRouterScope({
      routePaths: ["/", "/next"],
      pathname: "/",
      search: "",
      defaultTransitionName: "none",
      memory: false,
      browserDriver: createBrowserHistoryDriver(ROUTER_KEY),
      hostedScope: null,
      routerKey: ROUTER_KEY,
      deferEntryAdoption: true
    });
    const seeded = scope.history.getState().histories[0];
    scope.history.setState({
      histories: [seeded, { ...seeded, id: "pushed", pathname: "/next" }],
      index: 1
    });

    adoptEntryIdentity(scope);
    expect(scope.history.getState().histories[0].id).toBe("root");
  });

  it("has no browser entry to adopt in a memory scope", () => {
    seedRestoredEntry();
    const scope = createRouterScope({
      routePaths: ["/"],
      pathname: "/",
      search: "",
      defaultTransitionName: "none",
      memory: true,
      browserDriver: null,
      hostedScope: null,
      routerKey: ROUTER_KEY,
      deferEntryAdoption: true
    });
    adoptEntryIdentity(scope);
    expect(scope.history.getState().histories[0].id).toBe("root");
  });

  // A HOSTED scope carries no router key, so its frames live bare in the entry
  // rather than under a key. The adoption has to reach them the same way.
  it("reads the bare entry when the scope has no router key", () => {
    window.history.replaceState({ id: RESTORED, index: 4, params: { b: "2" } }, "", "/");
    const scope = createRouterScope({
      routePaths: ["/"],
      pathname: "/",
      search: "",
      defaultTransitionName: "none",
      memory: false,
      browserDriver: createBrowserHistoryDriver(),
      hostedScope: null,
      deferEntryAdoption: true
    });

    adoptEntryIdentity(scope);

    const seed = scope.history.getState().histories[0];
    expect(seed.id).toBe(RESTORED);
    expect(seed.frameIndex).toBe(4);
  });

  // A frame written by an older build, or by a host that only stamped an id,
  // carries neither params nor an index. Neither may come through as undefined.
  it("keeps the seed's own params and browser position when the frame omits them", () => {
    window.history.replaceState({ [ROUTER_KEY]: { id: RESTORED } }, "", "/");
    const scope = createRouterScope({
      routePaths: ["/"],
      pathname: "/",
      search: "",
      defaultTransitionName: "none",
      memory: false,
      browserDriver: createBrowserHistoryDriver(ROUTER_KEY),
      hostedScope: null,
      routerKey: ROUTER_KEY,
      deferEntryAdoption: true
    });
    const before = scope.history.getState().histories[0].params;

    adoptEntryIdentity(scope);

    const seed = scope.history.getState().histories[0];
    expect(seed.id).toBe(RESTORED);
    expect(seed.params).toBe(before);
    expect(seed.frameIndex).toBe(0);
  });
});
