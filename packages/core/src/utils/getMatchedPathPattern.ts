import { pathToRegexp, type Path } from "path-to-regexp";

export default function getMatchedPathPattern(paths: Path | Path[], pathname: string): Path {
  if (Array.isArray(paths)) {
    return paths.find((p) => pathToRegexp(p).regexp.test(pathname)) ?? "";
  }

  return pathToRegexp(paths).regexp.test(pathname) ? paths : "";
}
