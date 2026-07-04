import {
  Children,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode
} from "react";

import {
  createBrowserHistoryDriver,
  createRouterScope,
  ensureWindowHistoryState,
  isServer,
  type HistoryDriver,
  type PartTransition,
  type Decorator,
  type Transition,
  type TransitionName
} from "@flemo/core";

import HistoryListener from "@history/HistoryListener";

import Renderer from "@renderer/Renderer";

import ScreenContext from "@screen/ScreenContext";

import ScreenViewportContext from "@screen/ScreenViewportContext";

import useTransitionStyles from "@transition/styles";

import StoreContext, { type FlemoStores } from "@stores/StoreContext";

import RouterDepthContext from "./RouterDepthContext";
import Slot from "./Slot";

import type { RouteProps } from "@Route";

// Find a <Slot> in the layout tree and return its <Route> children — the route
// declarations to seed and match against. The Slot may sit anywhere in the
// static JSX the Router receives (nested in layout divs is fine), so walk
// recursively. null when there's no Slot: the Router then treats its own
// children as the routes (the bare, full-viewport form).
function findSlotRoutes(node: ReactNode): ReactElement<RouteProps>[] | null {
  let routes: ReactElement<RouteProps>[] | null = null;
  Children.forEach(node, (child) => {
    if (routes || !isValidElement(child)) return;
    if (child.type === Slot) {
      routes = Children.toArray((child.props as PropsWithChildren).children).filter(
        isValidElement
      ) as ReactElement<RouteProps>[];
      return;
    }
    const nested = (child.props as PropsWithChildren).children;
    if (nested) {
      const found = findSlotRoutes(nested);
      if (found) routes = found;
    }
  });
  return routes;
}

interface RouterProps {
  initPath?: string;
  defaultTransitionName?: TransitionName;
  transitions?: Transition[];
  decorators?: Decorator[];
  partTransitions?: PartTransition[];
  // Which history backend this Router drives. "browser" (default) reads/writes
  // `window.history` so the URL and browser back/forward work inside it, even
  // when the Router is nested. "memory" keeps an isolated in-memory stack that
  // never touches `window.history`, the URL, or browser back. History mode is
  // independent of nesting: nesting only controls the contained box rendering.
  history?: "browser" | "memory";
  // Override the browser history backend. Receives this Router's key (for state
  // namespacing) and returns a HistoryDriver — e.g. a locale-aware wrapper that
  // maps a URL prefix while the Router stays in unprefixed path space, so it
  // never reads or writes `window.location` directly. Ignored for
  // history="memory". Defaults to the keyed browser driver.
  createDriver?: (routerKey?: string) => HistoryDriver;
  // Applied to the region box of a NESTED <Router> only (a root <Router> renders
  // no wrapper — its screens are fixed to the viewport). Size the region here.
  className?: string;
  style?: CSSProperties;
}

const EMPTY_TRANSITIONS: Transition[] = [];
const EMPTY_DECORATORS: Decorator[] = [];
const EMPTY_PART_TRANSITIONS: PartTransition[] = [];

// Stable context value so a nested Router's screens don't re-render on identity churn.
const CONTAINED_VIEWPORT = { contained: true };

function Router({
  children,
  initPath = "/",
  defaultTransitionName = "cupertino",
  transitions = EMPTY_TRANSITIONS,
  decorators = EMPTY_DECORATORS,
  partTransitions = EMPTY_PART_TRANSITIONS,
  history = "browser",
  createDriver,
  className,
  style
}: PropsWithChildren<RouterProps>) {
  // A <Router> rendered inside another is a nested transition region: it contains
  // its screens to its box. Detected via depth, NOT the store context, since a
  // parent Router already provides a (seeded) StoreContext to its descendants.
  // Nesting controls ONLY the contained rendering; the history backend is chosen
  // by the `history` prop, independent of depth.
  const depth = useContext(RouterDepthContext);
  const isNested = depth > 0;

  // The history backend. "browser" (the default, even when nested) participates
  // in `window.history`; "memory" runs an isolated in-memory stack.
  const useMemory = history === "memory";

  // A stable per-Router id. The browser driver namespaces its `history.state`
  // under this key so multiple browser Routers on one page don't clobber each
  // other's frame or mis-handle each other's popstate.
  //
  // A NESTED Router derives the key from its enclosing screen's history-entry
  // id instead of useId: the entry id is stored in the browser frame and
  // restored verbatim when a traversal re-pushes the screen, so a remounted
  // Router reads the frames its previous incarnation wrote. useId's client
  // counter changes on every remount, which orphaned those frames — after a
  // rapid back-across-the-boundary-then-forward, the reborn Router classified
  // every traversal as foreign and the URL walked away from the screen. The
  // root Router keeps useId (hydration-stable; a root remount is an app
  // teardown, not a traversal).
  const reactId = useId();
  const parentScreen = useContext(ScreenContext);
  const routerKey = isNested && parentScreen.id ? `_F_${parentScreen.id}_` : reactId;

  // When the layout marks a content region with <Slot>, the routes live inside
  // it and the rest of `children` is persistent chrome (rendered as-is, with the
  // Slot rendering the screen stack at its position). Without a Slot, `children`
  // are the routes and the Router renders the full-viewport stack itself.
  const slotRoutes = findSlotRoutes(children);
  const hasSlot = slotRoutes !== null;

  // A <RouterScopeProvider> above the Router hosts the bundle so siblings outside the Router (an
  // inspector/devtools panel) can read it. Adopt it when present; otherwise own the bundle here.
  // Ignored when nested: a nested Router always owns its own (local) bundle.
  const parentStores = useContext(StoreContext);
  const hostedStores = isNested ? null : parentStores;
  const isHosted = hostedStores !== null;

  // One driver per Router, created eagerly for every browser Router so the seed
  // pathname is read THROUGH the driver (never window.location directly). A
  // custom factory (e.g. a locale-aware wrapper) then owns the whole URL surface.
  // Memory builds its driver in the store init (it needs the seeded root frame).
  const createBrowserDriver = createDriver ?? createBrowserHistoryDriver;
  const [browserDriver] = useState<HistoryDriver | null>(() =>
    useMemory ? null : createBrowserDriver(isHosted ? undefined : routerKey)
  );

  // Only a root browser Router reads the live browser location to seed its first
  // frame. A nested Router (browser or memory) and a memory root seed from
  // initPath: a nested browser rides the host's current entry rather than
  // reflecting the host's URL.
  const readsWindowLocation = !isNested && !useMemory && !isServer();
  // initPath may carry a query (a deep-linked step, e.g. /playground/1?code=x).
  // Split it so the route matches on the clean pathname while its params still
  // resolve from the search. A no-query initPath is unchanged.
  const location =
    readsWindowLocation && browserDriver ? browserDriver.readPathname() : initPath || "/";
  const queryIndex = location.indexOf("?");
  const pathname = (queryIndex >= 0 ? location.slice(0, queryIndex) : location) || "/";
  const search = readsWindowLocation
    ? window.location.search
    : queryIndex >= 0
      ? location.slice(queryIndex)
      : "";

  // Create (or adopt) the request-scoped store bundle once per mount. The
  // seeding / driver / guard logic is @flemo/core's createRouterScope (because
  // the seed is the store's *initial* state, zustand hands it to React as the
  // SSR snapshot); this binding only resolves the route declarations from its
  // JSX children.
  const [stores] = useState<FlemoStores>(() => {
    const routeChildren = slotRoutes ?? (Children.toArray(children) as ReactElement<RouteProps>[]);
    const routePaths = routeChildren.map((child) => child.props.path).flat();
    return createRouterScope({
      routePaths,
      pathname,
      search,
      defaultTransitionName,
      memory: useMemory,
      browserDriver,
      hostedScope: hostedStores
    });
  });

  // Keep the seeded default in sync if the prop changes across renders.
  stores.transition.setState({ defaultTransitionName });

  // Router liveness for queued navigation tasks: a push/pop task can sit in
  // the shared queue behind an in-flight transition and run after this Router
  // unmounted — it must abort rather than move the browser history for screens
  // that no longer exist. Set on every mount (strict-mode remounts and hosted
  // re-adoption included), cleared on unmount.
  useEffect(() => {
    stores.life.alive = true;
    return () => {
      stores.life.alive = false;
    };
  }, [stores]);

  // Registers user-provided transitions/decorators with the global maps and
  // injects the compiled CSS keyframes into the document head. Runs in
  // useInsertionEffect so styles are committed before any screen paints.
  useTransitionStyles(transitions, decorators, partTransitions);

  useEffect(() => {
    // A browser Router (root OR nested) seeds its own keyed frame into the
    // current entry without changing the URL, so a back into an entry predating
    // this Router still resolves its key. A memory Router never touches the
    // browser history. A hosted bundle keeps the legacy keyless (bare) seed.
    if (useMemory || isServer()) return;

    // Whether the CURRENT entry already carries this Router's frame — read
    // BEFORE the seed below creates one. A remounted Router (its screen
    // re-entered by a traversal) can mount while the browser has already moved
    // further ahead (a queued forward), and the entry under it then belongs to
    // a PREVIOUS incarnation's navigation, not to this fresh seed. Reflecting
    // the seed URL into that entry would corrupt it (a /playground/2 entry
    // renamed to /playground/1 while still carrying the panel-2 frame).
    const entryPredatesThisRouter =
      isNested && !isHosted && browserDriver ? browserDriver.readState() == null : false;

    ensureWindowHistoryState(
      isHosted ? null : routerKey,
      defaultTransitionName,
      stores.history.getState().histories[0]?.params ?? {}
    );

    // A NESTED browser Router reflects its own seed path in the address bar, so
    // the URL shows the screen actually mounted (e.g. /playground/1, not the
    // host's bare /playground). Routed through the driver (not window directly)
    // so a locale-aware driver keeps its URL prefix; the keyed state is
    // preserved. A deep link already matches its seed, so this is a no-op —
    // and an entry a previous incarnation already wrote to is never renamed
    // (see above).
    if (
      isNested &&
      !isHosted &&
      browserDriver &&
      entryPredatesThisRouter &&
      browserDriver.readPathname() !== pathname
    ) {
      browserDriver.replaceState(browserDriver.readState(), pathname);
    }
  }, [
    useMemory,
    isHosted,
    isNested,
    routerKey,
    pathname,
    defaultTransitionName,
    stores.history,
    browserDriver
  ]);

  // With a <Slot>, render the layout as-is (the Slot renders the contained stack
  // at its position); without one, render the stack directly. `children` already
  // carries its own positioning in the Slot case, so the bare-children form is
  // the same for root (viewport-fixed) and nested (the region box wraps it).
  const stack = hasSlot ? children : <Renderer>{children}</Renderer>;

  // A browser Router (root OR nested) runs the popstate-to-navigation bridge over
  // its own keyed driver + guard. A memory Router runs none (its driver's
  // traversals are awaited inline by the controller).
  const content = (
    <RouterDepthContext.Provider value={depth + 1}>
      <StoreContext.Provider value={stores}>
        {!useMemory && <HistoryListener />}
        {isNested ? (
          <ScreenViewportContext.Provider value={CONTAINED_VIEWPORT}>
            {stack}
          </ScreenViewportContext.Provider>
        ) : (
          stack
        )}
      </StoreContext.Provider>
    </RouterDepthContext.Provider>
  );

  // A nested region contains its screens to a positioned box (the consumer sizes
  // it via className/style) and clips the slide overflow. Everything outside this
  // <Router> in the layout persists across its navigations. A root Router renders
  // no wrapper: its screens are fixed to the viewport.
  if (isNested) {
    return (
      <div className={className} style={{ position: "relative", overflow: "hidden", ...style }}>
        {content}
      </div>
    );
  }

  return content;
}

export default Router;
