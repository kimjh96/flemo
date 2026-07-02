import { compile, parse, type Path } from "path-to-regexp";

// Compiles a route pattern + params into a concrete pathname. Params consumed
// by the pattern's tokens fill the path; the leftovers become the query
// string. `toPathname` is the bare compiled path (no query) for callers that
// need the route position without the params. Framework-neutral: bindings
// wrap this with their own typed route registry (e.g. React's RegisterRoute).
export default function buildRoutePath(
  path: Path,
  params: Record<string, unknown> | undefined
): { pathname: string; toPathname: string } {
  const paramRecord = params ?? {};
  const toPath = compile(path);
  const toPathParams = Object.fromEntries(
    Object.entries(paramRecord).map(([key, value]) => [key, String(value)])
  );
  const toPathname = toPath(toPathParams);
  const routeData = typeof path === "string" ? parse(path) : path;
  const usedParamKeys = routeData.tokens
    .filter((token) => token.type === "param")
    .map((token) => token.name);
  const remainingParams = Object.fromEntries(
    Object.entries(paramRecord).filter(([key]) => !usedParamKeys.includes(key))
  );
  const search = new URLSearchParams(remainingParams as Record<string, string>).toString();
  const pathname = `${toPathname}${search ? `?${search}` : ""}`;

  return { pathname, toPathname };
}
