import { Children, useEffect, useState, type PropsWithChildren, type ReactElement } from "react";

import {
  createHistoryStore,
  createNavigateStore,
  createTransitionStore,
  getParams,
  isServer,
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

  // Create the request-scoped stores once per mount, seeding history with the root frame derived
  // from initPath. Because the seed is the store's *initial* state, zustand hands it to React as
  // the SSR snapshot — so the screen renders on the server and each request keeps its own stack.
  const [stores] = useState<FlemoStores>(() => ({
    history: createHistoryStore(
      [
        {
          id: "root",
          pathname,
          params: getParams(
            Children.toArray(children)
              .map((child) => (child as ReactElement<RouteProps>).props.path)
              .flat(),
            pathname,
            search
          ),
          transitionName: defaultTransitionName,
          layoutId: null
        }
      ],
      0
    ),
    navigate: createNavigateStore(),
    transition: createTransitionStore(defaultTransitionName),
    screen: createScreenStore()
  }));

  // Keep the seeded default in sync if the prop changes across renders.
  stores.transition.setState({ defaultTransitionName });

  // Registers user-provided transitions/decorators with the global maps and
  // injects the compiled CSS keyframes into the document head. Runs in
  // useInsertionEffect so styles are committed before any screen paints.
  useTransitionStyles(transitions, decorators);

  useEffect(() => {
    if (window.history.state?.index) return;

    window.history.replaceState(
      {
        id: "root",
        index: 0,
        status: "IDLE",
        params: {},
        transitionName: defaultTransitionName,
        layoutId: null
      },
      "",
      window.location.href
    );
  }, [defaultTransitionName]);

  return (
    <StoreContext.Provider value={stores}>
      <HistoryListener />
      <Renderer>{children}</Renderer>
    </StoreContext.Provider>
  );
}

export default Router;
