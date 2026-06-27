import {
  Children,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
  type ReactElement
} from "react";

import {
  createHistoryStore,
  createNavigateStore,
  createTransitionStore,
  ensureWindowHistoryState,
  isServer,
  seedInitialHistory,
  type Decorator,
  type Transition,
  type TransitionName
} from "@flemo/core";

import HistoryListener from "@history/HistoryListener";

import Renderer from "@renderer/Renderer";

import createScreenStore from "@screen/store";

import useTransitionStyles from "@transition/styles";

import StoreContext, { type FlemoStores } from "@stores/StoreContext";

import type { RouteProps } from "@Route";

interface RouterProps {
  initPath?: string;
  defaultTransitionName?: TransitionName;
  transitions?: Transition[];
  decorators?: Decorator[];
}

const EMPTY_TRANSITIONS: Transition[] = [];
const EMPTY_DECORATORS: Decorator[] = [];

function Router({
  children,
  initPath = "/",
  defaultTransitionName = "cupertino",
  transitions = EMPTY_TRANSITIONS,
  decorators = EMPTY_DECORATORS
}: PropsWithChildren<RouterProps>) {
  const pathname = isServer() ? initPath || "/" : window.location.pathname;
  const search = isServer() ? pathname.split("?")[1] || "" : window.location.search;

  // A <RouterScopeProvider> above the Router hosts the bundle so siblings outside the Router (an
  // inspector/devtools panel) can read it. Adopt it when present; otherwise own the bundle here.
  const hostedStores = useContext(StoreContext);

  // Create the request-scoped stores once per mount, seeding history with the root frame derived
  // from initPath. Because the seed is the store's *initial* state, zustand hands it to React as
  // the SSR snapshot, so the screen renders on the server and each request keeps its own stack.
  const [stores] = useState<FlemoStores>(() => {
    const routePaths = Children.toArray(children)
      .map((child) => (child as ReactElement<RouteProps>).props.path)
      .flat();
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

    return {
      history: createHistoryStore([rootHistory], 0),
      navigate: createNavigateStore(),
      transition: createTransitionStore(defaultTransitionName),
      screen: createScreenStore()
    };
  });

  // Keep the seeded default in sync if the prop changes across renders.
  stores.transition.setState({ defaultTransitionName });

  // Registers user-provided transitions/decorators with the global maps and
  // injects the compiled CSS keyframes into the document head. Runs in
  // useInsertionEffect so styles are committed before any screen paints.
  useTransitionStyles(transitions, decorators);

  useEffect(() => {
    ensureWindowHistoryState(defaultTransitionName);
  }, [defaultTransitionName]);

  return (
    <StoreContext.Provider value={stores}>
      <HistoryListener />
      <Renderer>{children}</Renderer>
    </StoreContext.Provider>
  );
}

export default Router;
