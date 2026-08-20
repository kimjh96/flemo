import { useContext } from "react";

import {
  createNavigationController,
  type NavigateOptions,
  type PopOptions,
  type TransitionName
} from "@flemo/core";

import buildRoutePath from "@utils/buildRoutePath";
import { devFail, devWarn } from "@utils/devDiagnostics";

import useStores from "@stores/useStores";

import RouterScopeContext, { type RouterScopeNode } from "../RouterScopeContext";
import resolveRouterTarget, { ownsRoute, type RouterTarget } from "../RouterTarget";

import type { RegisterRoute } from "@Route";

// Typed distance options: narrows `until` to the route registry. The runtime
// orchestration lives in @flemo/core's createNavigationController; this hook is
// the thin React binding that wires the request-scoped stores + the typed path
// compiler and re-exposes push/replace/pop with route-typed signatures.
interface DistanceOptions {
  skip?: number;
  until?: keyof RegisterRoute;
}

// Which Router a navigation runs against. Omitted everywhere, the behavior is
// exactly what it always was: the nearest enclosing <Router>.
//
// As a hook argument it is the DEFAULT target for every call it returns
// (`useNavigate({ router: "app" })` navigates the <Router name="app"> above
// this call); as a per-call option it OVERRIDES that default.
export interface UseNavigateOptions {
  router?: RouterTarget;
}

type RouteOptions = DistanceOptions &
  UseNavigateOptions & {
    layoutId?: string | number;
    transitionName?: TransitionName;
  };

type PopRouteOptions = DistanceOptions & UseNavigateOptions & { transitionName?: TransitionName };

export default function useNavigate(defaults?: UseNavigateOptions) {
  const stores = useStores();
  const contextScope = useContext(RouterScopeContext);

  // The chain node is only missing when useNavigate runs under a bare
  // StoreContext (a custom host, a test bundle). Degrade to a single-node
  // chain: the default target keeps working unchanged, and an explicit target
  // reports "no such Router" instead of silently doing something else.
  const scope: RouterScopeNode = contextScope ?? {
    stores,
    routePaths: [],
    strictRoutes: false,
    parent: null,
    depth: 0
  };

  // Resolve the target Router and build ITS controller. Deliberately a
  // synchronous step taken BEFORE any task is queued: the whole navigation
  // then runs against the selected Router's own stores / driver / self-pop
  // guard from the first line (never "change the URL and hope another
  // Router's HistoryListener reacts"), and a development error surfaces on the
  // caller's own stack instead of as an unhandled promise rejection.
  const selectController = (target: RouterTarget | undefined, path?: string, params?: object) => {
    // Call-level target wins over the hook-level default.
    const requested = target ?? defaults?.router;
    // Compiled ahead of the controller so ownership can be judged on the
    // CONCRETE pathname (a Router declaring `/files/*splat` owns `/files/a`).
    // A compile failure is not this step's business: swallow it so the error
    // still surfaces where it always did, inside the navigation task, and
    // ownership falls back to comparing the declared patterns.
    let pathname: string | undefined;
    if (path) {
      try {
        pathname = buildRoutePath(path, params as RegisterRoute[keyof RegisterRoute]).toPathname;
      } catch {
        pathname = undefined;
      }
    }

    const { node, message } = resolveRouterTarget({
      from: scope,
      target: requested,
      path,
      pathname
    });

    if (!node) {
      devFail(message ?? "the requested Router could not be resolved.");
      return null;
    }
    if (message) devWarn(message);

    // A path the target Router never declared cannot mount a screen there: the
    // renderer skips the entry and the region transitions to nothing. Explicit
    // targets are a new API, so they fail loudly in development; an implicit
    // (nearest-Router) target keeps its historical behavior and only warns,
    // unless that Router opted into `strictRoutes`.
    if (path && !ownsRoute(node, path, pathname)) {
      const where = node.name ? `<Router name="${node.name}">` : "the target <Router>";
      const detail =
        `"${path}" is not declared by ${where}, so the navigation cannot mount a screen there. ` +
        'Declare a matching <Route>, target the Router that owns it, or use `router: "nearest-owner"`.';
      if (requested !== undefined || node.strictRoutes) devFail(detail);
      else devWarn(detail);
    }

    return createNavigationController({
      stores: node.stores,
      buildPathname: (routePath, routeParams) =>
        buildRoutePath(routePath, routeParams as RegisterRoute[keyof RegisterRoute]),
      driver: node.stores.driver,
      markSelfInduced: node.stores.markSelfInduced
    });
  };

  return {
    push: <T extends keyof RegisterRoute>(
      path: T,
      params?: RegisterRoute[T],
      options?: RouteOptions
    ) => {
      const controller = selectController(options?.router, path as string, params ?? {});
      return controller
        ? controller.push(path as string, params ?? {}, options as NavigateOptions)
        : Promise.resolve();
    },
    replace: <T extends keyof RegisterRoute>(
      path: T,
      params?: RegisterRoute[T],
      options?: RouteOptions
    ) => {
      const controller = selectController(options?.router, path as string, params ?? {});
      return controller
        ? controller.replace(path as string, params ?? {}, options as NavigateOptions)
        : Promise.resolve();
    },
    pop: (options?: PopRouteOptions) => {
      const controller = selectController(options?.router);
      return controller ? controller.pop(options as PopOptions) : Promise.resolve();
    }
  };
}
