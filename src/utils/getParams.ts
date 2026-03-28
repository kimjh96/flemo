import { match, type Path } from "path-to-regexp";

import getMatchedPathPattern from "@utils/getMatchedPathPattern";

export default function getParams(paths: Path | Path[], path: string, search: string) {
  const regex = getMatchedPathPattern(paths, path);
  const matchPath = match(regex)(path);
  const searchParams = new URLSearchParams(search);
  const params = Object.fromEntries(searchParams.entries());

  if (matchPath) {
    return { ...(matchPath.params as Record<string, string>), ...params };
  }

  return {};
}
