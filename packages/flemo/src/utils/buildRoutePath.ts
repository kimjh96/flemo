import { compile, parse, type Path } from "path-to-regexp";

import type { RegisterRoute } from "@Route";

export default function buildRoutePath<T extends keyof RegisterRoute>(
  path: Path,
  params: RegisterRoute[T]
): { pathname: string; toPathname: string } {
  const paramRecord = (params ?? {}) as Record<string, unknown>;
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
