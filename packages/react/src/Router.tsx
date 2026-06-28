import {
  Children,
  isValidElement,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode
} from "react";

import {
  createBrowserHistoryDriver,
  createHistoryStore,
  createMemoryHistoryDriver,
  createNavigateStore,
  createTransitionStore,
  ensureWindowHistoryState,
  isServer,
  markSelfInducedPop,
  seedInitialHistory,
  type PartTransition,
  type Decorator,
  type Transition,
  type TransitionName
} from "@flemo/core";

import HistoryListener from "@history/HistoryListener";

import Renderer from "@renderer/Renderer";

import ScreenViewportContext from "@screen/ScreenViewportContext";
import createScreenStore from "@screen/store";

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
  className,
  style
}: PropsWithChildren<RouterProps>) {
  // A <Router> rendered inside another is a nested transition region: it owns a
  // local in-memory history, contains its screens to its box, and stays off the
  // browser's global history. Detected via depth, NOT the store context, since a
  // parent Router already provides a (seeded) StoreContext to its descendants.
  const depth = useContext(RouterDepthContext);
  const isNested = depth > 0;

  // When the layout marks a content region with <Slot>, the routes live inside
  // it and the rest of `children` is persistent chrome (rendered as-is, with the
  // Slot rendering the screen stack at its position). Without a Slot, `children`
  // are the routes and the Router renders the full-viewport stack itself.
  const slotRoutes = findSlotRoutes(children);
  const hasSlot = slotRoutes !== null;

  // A nested region navigates in its own initPath-seeded stack; only the root
  // reads the browser location.
  const pathname = isNested || isServer() ? initPath || "/" : window.location.pathname;
  const search = isNested || isServer() ? pathname.split("?")[1] || "" : window.location.search;

  // A <RouterScopeProvider> above the Router hosts the bundle so siblings outside the Router (an
  // inspector/devtools panel) can read it. Adopt it when present; otherwise own the bundle here.
  // Ignored when nested: a nested Router always owns its own (local) bundle.
  const parentStores = useContext(StoreContext);
  const hostedStores = isNested ? null : parentStores;

  // Create the request-scoped stores once per mount, seeding history with the root frame derived
  // from initPath. Because the seed is the store's *initial* state, zustand hands it to React as
  // the SSR snapshot, so the screen renders on the server and each request keeps its own stack.
  const [stores] = useState<FlemoStores>(() => {
    const routeChildren = slotRoutes ?? (Children.toArray(children) as ReactElement<RouteProps>[]);
    const routePaths = routeChildren.map((child) => child.props.path).flat();
    const rootHistory = seedInitialHistory(routePaths, pathname, search, defaultTransitionName);

    // Hosted bundle: seed its history once (it starts empty at index -1). Seeding here rather than
    // at creation means a hosted setup doesn't get the SSR snapshot, but the provider is for
    // client-side devtools layouts, so that's fine.
    if (hostedStores) {
      if (hostedStores.history.getState().index === -1) {
        hostedStores.history.setState({ index: 0, histories: [rootHistory] });
      }
      return hostedStores;
    }

    // A nested region drives an in-memory history (seeded to match its root
    // frame) and never marks the shared self-pop guard; the root drives the
    // browser History API and shares the guard with its history sync.
    const driver = isNested
      ? createMemoryHistoryDriver({
          state: {
            id: rootHistory.id,
            index: 0,
            status: "IDLE",
            params: rootHistory.params,
            transitionName: rootHistory.transitionName,
            layoutId: rootHistory.layoutId
          },
          url: rootHistory.pathname
        })
      : createBrowserHistoryDriver();

    return {
      history: createHistoryStore([rootHistory], 0),
      navigate: createNavigateStore(),
      transition: createTransitionStore(defaultTransitionName),
      screen: createScreenStore(),
      driver,
      markSelfInduced: isNested ? () => {} : markSelfInducedPop
    };
  });

  // Keep the seeded default in sync if the prop changes across renders.
  stores.transition.setState({ defaultTransitionName });

  // Registers user-provided transitions/decorators with the global maps and
  // injects the compiled CSS keyframes into the document head. Runs in
  // useInsertionEffect so styles are committed before any screen paints.
  useTransitionStyles(transitions, decorators, partTransitions);

  useEffect(() => {
    // Only the root seeds the browser history; a nested region never touches it.
    if (!isNested) ensureWindowHistoryState(defaultTransitionName);
  }, [defaultTransitionName, isNested]);

  // A nested region: contain its screens to a positioned box (the consumer sizes
  // it via className/style), clip the slide overflow, and run no global history
  // listener. Everything outside this <Router> in the layout persists across its
  // navigations.
  // With a <Slot>, render the layout as-is (the Slot renders the contained stack
  // at its position); without one, render the stack directly. `children` already
  // carries its own positioning in the Slot case, so the bare-children form is
  // the same for root (viewport-fixed) and nested (the region box wraps it).
  const stack = hasSlot ? children : <Renderer>{children}</Renderer>;

  if (isNested) {
    return (
      <div className={className} style={{ position: "relative", overflow: "hidden", ...style }}>
        <RouterDepthContext.Provider value={depth + 1}>
          <StoreContext.Provider value={stores}>
            <ScreenViewportContext.Provider value={CONTAINED_VIEWPORT}>
              {stack}
            </ScreenViewportContext.Provider>
          </StoreContext.Provider>
        </RouterDepthContext.Provider>
      </div>
    );
  }

  return (
    <RouterDepthContext.Provider value={depth + 1}>
      <StoreContext.Provider value={stores}>
        <HistoryListener />
        {stack}
      </StoreContext.Provider>
    </RouterDepthContext.Provider>
  );
}

export default Router;
