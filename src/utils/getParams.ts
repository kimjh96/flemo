import { match, pathToRegexp, type Path } from "path-to-regexp";

export default function getParams(paths: Path | Path[], path: string, search: string) {
  const regex = Array.isArray(paths)
    ? paths.find((p) => pathToRegexp(p).regexp.test(path)) || ""
    : pathToRegexp(paths).regexp.test(path)
      ? paths
      : "";
  const matchPath = match(regex)(path);
  const searchParams = new URLSearchParams(search);
  const params = Object.fromEntries(searchParams.entries());

  if (matchPath) {
    return { ...(matchPath.params as Record<string, string>), ...params };
  }

  return {};
}
