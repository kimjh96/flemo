import { Children, useEffect, type PropsWithChildren, type ReactElement } from "react";

import {
  getParams,
  isServer,
  useHistoryStore,
  useTransitionStore,
  type Decorator,
  type Transition,
  type TransitionName
} from "@flemo/core";

import HistoryListener from "@history/HistoryListener";

import Renderer from "@renderer/Renderer";

import useTransitionStyles from "@transition/styles";

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

  useTransitionStore.setState({
    defaultTransitionName
  });
  useHistoryStore.setState({
    index: 0,
    histories: [
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
    ]
  });

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
    <>
      <HistoryListener />
      <Renderer>{children}</Renderer>
    </>
  );
}

export default Router;
