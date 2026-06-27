import {
  createNavigationController,
  type NavigateOptions,
  type PopOptions,
  type TransitionName
} from "@flemo/core";

import buildRoutePath from "@utils/buildRoutePath";

import useStores from "@stores/useStores";

import type { RegisterRoute } from "@Route";

// Typed distance options: narrows `until` to the route registry. The runtime
// orchestration lives in @flemo/core's createNavigationController; this hook is
// the thin React binding that wires the request-scoped stores + the typed path
// compiler and re-exposes push/replace/pop with route-typed signatures.
interface DistanceOptions {
  skip?: number;
  until?: keyof RegisterRoute;
}

type RouteOptions = DistanceOptions & {
  layoutId?: string | number;
  transitionName?: TransitionName;
};

export default function useNavigate() {
  const stores = useStores();

  const controller = createNavigationController({
    stores,
    buildPathname: (path, params) =>
      buildRoutePath(path, params as RegisterRoute[keyof RegisterRoute])
  });

  return {
    push: <T extends keyof RegisterRoute>(
      path: T,
      params?: RegisterRoute[T],
      options?: RouteOptions
    ) => controller.push(path as string, params ?? {}, options as NavigateOptions),
    replace: <T extends keyof RegisterRoute>(
      path: T,
      params?: RegisterRoute[T],
      options?: RouteOptions
    ) => controller.replace(path as string, params ?? {}, options as NavigateOptions),
    pop: (options?: DistanceOptions & { transitionName?: TransitionName }) =>
      controller.pop(options as PopOptions)
  };
}
