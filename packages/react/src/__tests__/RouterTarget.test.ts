import { describe, expect, it } from "vitest";

import { createTestStores } from "@stores/__tests__/testUtils";

import resolveRouterTarget, {
  describeAncestry,
  findDuplicateNamedAncestor,
  ownsRoute
} from "../RouterTarget";

import type { RouterScopeNode } from "../RouterScopeContext";

// The pure half of cross-Router navigation: given a scope chain (what each
// <Router> publishes) and a target, which Router runs the navigation. No React,
// no DOM — the binding only feeds it the chain it already built.
const node = (
  name: string | undefined,
  routePaths: string[],
  parent: RouterScopeNode | null,
  strictRoutes = false
): RouterScopeNode => ({
  name,
  stores: createTestStores(),
  routePaths,
  strictRoutes,
  parent,
  depth: parent ? parent.depth + 1 : 0
});

const app = () => node("app", ["/", "/members/:id", "/region", "/region/people"], null);

describe("resolveRouterTarget", () => {
  it("defaults to the calling Router when no target is given", () => {
    const root = app();
    const region = node("region", ["/region", "/region/people"], root);

    expect(resolveRouterTarget({ from: region }).node).toBe(region);
  });

  it('resolves "current", "parent" and "root"', () => {
    const root = app();
    const region = node("region", ["/region"], root);
    const inner = node("inner", ["/inner"], region);

    expect(resolveRouterTarget({ from: inner, target: "current" }).node).toBe(inner);
    expect(resolveRouterTarget({ from: inner, target: "parent" }).node).toBe(region);
    expect(resolveRouterTarget({ from: inner, target: "root" }).node).toBe(root);
  });

  it('reports a hard error for "parent" at the top of the chain', () => {
    const root = app();

    const { node: resolved, message } = resolveRouterTarget({ from: root, target: "parent" });
    expect(resolved).toBeNull();
    expect(message).toMatch(/no parent Router/);
  });

  it("finds a named Router along the active chain", () => {
    const root = app();
    const region = node("region", ["/region"], root);
    const inner = node("inner", ["/inner"], region);

    expect(resolveRouterTarget({ from: inner, target: "app" }).node).toBe(root);
    expect(resolveRouterTarget({ from: inner, target: "region" }).node).toBe(region);
  });

  it("never reaches a sibling Router: an unknown name is an error listing the chain", () => {
    const root = app();
    const region = node("region", ["/region"], root);
    // A sibling of `region` is NOT in this chain, so its name is unreachable.
    node("sidebar", ["/sidebar"], root);

    const { node: resolved, message } = resolveRouterTarget({ from: region, target: "sidebar" });
    expect(resolved).toBeNull();
    expect(message).toMatch(/no <Router name="sidebar">/);
    expect(message).toMatch(/"region" \(current\), "app" \(1 level\(s\) up\)/);
  });

  it("reads a bare string as a keyword first, and the object forms disambiguate", () => {
    const root = app();
    // A Router that named itself after a keyword.
    const parentNamed = node("parent", ["/weird"], root);
    const child = node("child", ["/child"], parentNamed);

    // Bare "parent" is the keyword: the enclosing Router.
    expect(resolveRouterTarget({ from: child, target: "parent" }).node).toBe(parentNamed);
    // Same result here, but by NAME rather than by relationship.
    expect(resolveRouterTarget({ from: child, target: { name: "parent" } }).node).toBe(parentNamed);
    // And a name lookup that collides with a keyword still resolves by name.
    expect(resolveRouterTarget({ from: root, target: { name: "parent" } }).node).toBeNull();
    expect(resolveRouterTarget({ from: child, target: { scope: "root" } }).node).toBe(root);
  });

  it('"nearest-owner" walks outwards to the first Router declaring the path', () => {
    const root = app();
    const region = node("region", ["/region", "/region/people"], root);

    const resolved = resolveRouterTarget({
      from: region,
      target: "nearest-owner",
      path: "/members/:id",
      pathname: "/members/7"
    });
    expect(resolved.node).toBe(root);
    expect(resolved.message).toBeNull();

    // The current Router owns it, so the walk stops immediately.
    expect(
      resolveRouterTarget({
        from: region,
        target: "nearest-owner",
        path: "/region/people",
        pathname: "/region/people"
      }).node
    ).toBe(region);
  });

  it('"nearest-owner" errors when no Router in the chain declares the path', () => {
    const root = app();
    const region = node("region", ["/region"], root);

    const { node: resolved, message } = resolveRouterTarget({
      from: region,
      target: "nearest-owner",
      path: "/unknown",
      pathname: "/unknown"
    });
    expect(resolved).toBeNull();
    expect(message).toMatch(/no <Router> in scope declares a <Route path="\/unknown">/);
  });

  it('"nearest-owner" falls back to "current" with a warning when there is no path (pop)', () => {
    const root = app();
    const region = node("region", ["/region"], root);

    const { node: resolved, message } = resolveRouterTarget({
      from: region,
      target: "nearest-owner"
    });
    // A fallback, not a failure: a node AND a message.
    expect(resolved).toBe(region);
    expect(message).toMatch(/pop\(\) carries none/);
  });
});

describe("ownsRoute", () => {
  const region = node("region", ["/region", "/region/people"], null);

  it("matches the declared pattern verbatim", () => {
    expect(ownsRoute(region, "/region/people", "/region/people")).toBe(true);
  });

  it("matches through the compiled pathname, so a superset pattern still owns it", () => {
    const files = node("files", ["/files/*splat"], null);
    expect(ownsRoute(files, "/files/a/b", "/files/a/b")).toBe(true);
  });

  it("rejects a path the Router never declared", () => {
    expect(ownsRoute(region, "/members/:id", "/members/7")).toBe(false);
  });

  it("treats a Router with no declared routes as owning everything", () => {
    // A bare StoreContext host (custom embedder, test bundle) publishes no
    // patterns: the check must never block a setup it cannot see into.
    expect(ownsRoute(node(undefined, [], null), "/members/:id", "/members/7")).toBe(true);
  });
});

describe("findDuplicateNamedAncestor", () => {
  it("finds an ancestor sharing the name", () => {
    const root = app();
    const middle = node("region", ["/region"], root);
    const leaf = node("app", ["/inner"], middle);

    expect(findDuplicateNamedAncestor(leaf)).toBe(root);
    expect(findDuplicateNamedAncestor(middle)).toBeNull();
  });

  it("ignores unnamed Routers", () => {
    const root = node(undefined, ["/"], null);
    const leaf = node(undefined, ["/inner"], root);

    expect(findDuplicateNamedAncestor(leaf)).toBeNull();
  });
});

describe("describeAncestry", () => {
  it("renders unnamed Routers by their position", () => {
    const root = node(undefined, ["/"], null);
    const region = node("region", ["/region"], root);

    expect(describeAncestry(region)).toBe('"region" (current), <unnamed> (1 level(s) up)');
  });
});
