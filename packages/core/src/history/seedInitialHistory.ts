import type { History } from "@history/store";

import type { TransitionName } from "@transition/typing";

import getParams from "@utils/getParams";

import type { Path } from "path-to-regexp";

// Build the root history frame the Router seeds its stack with, from the initial
// pathname + search and the declared route paths (so path params resolve).
// Framework-neutral: the binding supplies the route paths from its own route
// declarations (React children, etc.).
export default function seedInitialHistory(
  routePaths: Path[],
  pathname: string,
  search: string,
  defaultTransitionName: TransitionName
): History {
  return {
    id: "root",
    pathname,
    params: getParams(routePaths, pathname, search),
    transitionName: defaultTransitionName,
    layoutId: null
  };
}
