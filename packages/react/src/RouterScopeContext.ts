import { createContext } from "react";

import type { FlemoStores } from "@flemo/core";

import type { Path } from "path-to-regexp";

// One node of the Router SCOPE CHAIN: the store bundle of a <Router>, plus a
// link to the Router that encloses it. StoreContext alone only ever exposes the
// NEAREST bundle, so a nested Router's `useNavigate` could never reach the one
// above it — the chain is what makes `router: "parent" | "root" | "<name>"`
// resolvable without any DOM or global registry.
//
// Nodes are MUTATED in place by their owning Router (identity is stable for the
// Router's whole lifetime) so that a re-render never invalidates the context
// value: nothing in the tree needs to re-render because a route list changed,
// and consumers read the node at CALL time, never at render time.
export interface RouterScopeNode {
  // The `name` prop of the owning <Router>, when it declared one. The identity
  // navigation targets a Router by; independent of the internal `routerKey`
  // used to namespace `history.state` (see Router.tsx).
  name?: string;
  // The owning Router's request-scoped bundle — the stores, driver and
  // self-pop guard a navigation must be run against.
  stores: FlemoStores;
  // The route patterns this Router declares (its <Route path>s, flattened).
  // Used to answer "does this Router own that path?" for `nearest-owner` and
  // the missing-route diagnostic.
  routePaths: Path[];
  // When true, a navigation to a path this Router does not declare throws in
  // development instead of warning (see Router's `strictRoutes` prop).
  strictRoutes: boolean;
  // The enclosing <Router>'s node, or null at the top of the chain.
  parent: RouterScopeNode | null;
  // Nesting depth (0 = top of the chain), for diagnostics.
  depth: number;
}

const RouterScopeContext = createContext<RouterScopeNode | null>(null);

export default RouterScopeContext;
