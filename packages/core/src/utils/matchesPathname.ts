import { pathToRegexp, type Path } from "path-to-regexp";

// Whether a route pattern (or set of patterns) matches a concrete pathname.
// The renderer uses it to pick the <Route> a history entry mounts.
export default function matchesPathname(path: Path | Path[], pathname: string): boolean {
  return pathToRegexp(path as string).regexp.test(pathname);
}
