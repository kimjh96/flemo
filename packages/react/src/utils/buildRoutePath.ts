import { buildRoutePath as buildRoutePathCore } from "@flemo/core";

import type { RegisterRoute } from "@Route";
import type { Path } from "path-to-regexp";

// Typed façade over the framework-neutral path compiler in @flemo/core: the
// runtime is shared across bindings, only the RegisterRoute typing is
// React-side (it lives on this package's augmentation surface).
export default function buildRoutePath<T extends keyof RegisterRoute>(
  path: Path,
  params: RegisterRoute[T]
): { pathname: string; toPathname: string } {
  return buildRoutePathCore(path, params as Record<string, unknown> | undefined);
}
