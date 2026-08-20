import { matchesPathname } from "@flemo/core";

import type { RouterScopeNode } from "./RouterScopeContext";

// Router names, registered the same way routes and transitions are — augment
// it and `router: "app"` autocompletes and type-checks:
//
//   declare module "@flemo/react" {
//     interface RegisterRouter {
//       app: true;
//       region: true;
//     }
//   }
//
// eslint-disable-next-line
export interface RegisterRouter {}

// The relative ways to name a Router without knowing its name.
//   current       the nearest enclosing <Router> (the default, unchanged)
//   parent        the <Router> that encloses the current one
//   root          the outermost <Router> of the current chain
//   nearest-owner the first Router, current → ancestors, that declares the path
export type RouterScopeKeyword = "current" | "parent" | "root" | "nearest-owner";

// A Router name in TARGET position. Before any augmentation it stays an open
// string (`string & {}` rather than `string`, so the keyword literals keep
// their autocomplete) — `name` has to work without a registry. Once names ARE
// registered, the registry becomes the closed set: a target that names no
// registered Router is a compile error instead of a runtime one.
//
// Same asymmetry as routes: `<Route path>` is unconstrained because it IS the
// declaration, while `push()` is checked against `RegisterRoute` because it
// REFERENCES one. So `<Router name>` stays `string`; only targets are checked.
export type RouterName = keyof RegisterRouter extends never ? string & {} : keyof RegisterRouter;

// Where a navigation runs. A bare string is read as a KEYWORD first and as a
// Router name second, so `{ name: "parent" }` / `{ scope: "parent" }` are the
// unambiguous forms for a Router whose name collides with a keyword.
export type RouterTarget =
  RouterScopeKeyword | RouterName | { name: RouterName } | { scope: RouterScopeKeyword };

export interface ResolveRouterTargetInput {
  // The scope the call was made from (the nearest Router's node).
  from: RouterScopeNode;
  // The requested target; undefined means "current" (the legacy default).
  target?: RouterTarget;
  // The route pattern being navigated to. Absent for `pop`, which carries no
  // path — only `nearest-owner` needs one.
  path?: string;
  // The concrete pathname `path` + params compiles to, so a Router declaring a
  // superset pattern (`/files/*splat`) still counts as the owner.
  pathname?: string;
}

export interface RouterTargetResolution {
  // The Router to run the navigation against, or null when the target could
  // not be resolved at all.
  node: RouterScopeNode | null;
  // A development diagnostic. With `node` null it describes why nothing could
  // be selected (a hard error); with a node present it describes a FALLBACK
  // that was taken (a warning).
  message: string | null;
}

const KEYWORDS: readonly string[] = ["current", "parent", "root", "nearest-owner"];

const isKeyword = (value: string): value is RouterScopeKeyword => KEYWORDS.includes(value);

// The scope chain from `node` outwards, nearest first.
const ancestry = (node: RouterScopeNode): RouterScopeNode[] => {
  const chain: RouterScopeNode[] = [];
  for (let current: RouterScopeNode | null = node; current; current = current.parent) {
    chain.push(current);
  }
  return chain;
};

// Whether a Router declares the route being navigated to. Pattern equality
// first (the common case: the caller passes the very string the <Route> was
// declared with), then a match of the compiled pathname against the Router's
// whole pattern set. A Router with NO declared patterns (a bare StoreContext
// host, a test bundle) is treated as owning everything: the check exists to
// catch a wrong Router, never to block a setup it cannot see into.
export function ownsRoute(node: RouterScopeNode, path: string, pathname?: string): boolean {
  if (node.routePaths.length === 0) return true;
  if (node.routePaths.some((declared) => declared === path)) return true;
  return pathname ? matchesPathname(node.routePaths, pathname) : false;
}

// Human-readable rendering of the chain, for the dev diagnostics: an unnamed
// Router still needs to be countable in the message.
export function describeAncestry(from: RouterScopeNode): string {
  return ancestry(from)
    .map((node, position) => {
      const where = position === 0 ? "current" : `${position} level(s) up`;
      return node.name ? `"${node.name}" (${where})` : `<unnamed> (${where})`;
    })
    .join(", ");
}

// Pick the Router a navigation should run against. Pure: it only reads the
// scope chain the binding built, so it is fully unit-testable and carries no
// React or DOM dependency.
export default function resolveRouterTarget({
  from,
  target,
  path,
  pathname
}: ResolveRouterTargetInput): RouterTargetResolution {
  // The legacy default: the nearest Router, exactly as before this API existed.
  if (target === undefined) return { node: from, message: null };

  let keyword: RouterScopeKeyword | null = null;
  let name: string | null = null;

  if (typeof target === "string") {
    if (isKeyword(target)) keyword = target;
    else name = target;
  } else if ("scope" in target) {
    keyword = target.scope;
  } else {
    name = target.name as string;
  }

  if (name !== null) {
    // Names resolve along the ACTIVE chain only (current + ancestors), never
    // across siblings: a sibling Router is not in this call's lineage, and
    // picking one would move a stack the caller cannot see.
    const match = ancestry(from).find((node) => node.name === name);
    if (!match) {
      return {
        node: null,
        message:
          `no <Router name="${name}"> encloses this call. ` +
          `Routers in scope: ${describeAncestry(from)}.`
      };
    }
    return { node: match, message: null };
  }

  switch (keyword) {
    case "parent": {
      if (!from.parent) {
        return {
          node: null,
          message:
            'router: "parent" was requested, but the enclosing <Router> is the outermost one ' +
            "(it has no parent Router)."
        };
      }
      return { node: from.parent, message: null };
    }
    case "root": {
      const chain = ancestry(from);
      return { node: chain[chain.length - 1]!, message: null };
    }
    case "nearest-owner": {
      if (!path) {
        return {
          node: from,
          message:
            'router: "nearest-owner" needs a route to search for, and pop() carries none. ' +
            'Falling back to "current" — name the Router explicitly for a cross-Router pop.'
        };
      }
      const owner = ancestry(from).find((node) => ownsRoute(node, path, pathname));
      if (!owner) {
        return {
          node: null,
          message:
            `no <Router> in scope declares a <Route path="${path}">. ` +
            `Routers in scope: ${describeAncestry(from)}.`
        };
      }
      return { node: owner, message: null };
    }
    default:
      return { node: from, message: null };
  }
}

// The nearest ancestor that already uses `node`'s name. Two Routers sharing a
// name in ONE chain make `router: "<name>"` ambiguous (resolution silently
// takes the nearer one), so the binding reports it in development.
export function findDuplicateNamedAncestor(node: RouterScopeNode): RouterScopeNode | null {
  if (!node.name) return null;
  for (let current = node.parent; current; current = current.parent) {
    if (current.name === node.name) return current;
  }
  return null;
}
