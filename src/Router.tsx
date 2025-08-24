import { Children, useEffect, type PropsWithChildren, type ReactElement } from "react";

import getParams from "@utils/getParams";

import isServer from "@utils/isServer";

import HistoryListener from "@history/HistoryListener";
import useHistoryStore from "@history/store";
import Renderer from "@renderer/Renderer";

import { decoratorMap } from "@transition/decorator/decorator";
import useTransitionStore from "@transition/store";
import { transitionMap } from "@transition/transition";

import type { RouteProps } from "@Route";
import type { Decorator } from "@transition/decorator/typing";
import type { TransitionName, Transition } from "@transition/typing";

interface RouterProps {
  initPath?: string;
  defaultTransitionName?: TransitionName;
  transitions?: Transition[];
  decorators?: Decorator[];
}

function Router({
  children,
  initPath = "/",
  defaultTransitionName = "cupertino",
  transitions = [],
  decorators = []
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
        transitionName: defaultTransitionName
      }
    ]
  });

  useEffect(() => {
    transitions.forEach((transition) => transitionMap.set(transition.name, transition));
  }, [transitions]);

  useEffect(() => {
    decorators.forEach((decorator) => decoratorMap.set(decorator.name, decorator));
  }, [decorators]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%"
      }}
    >
      <HistoryListener />
      <Renderer>{children}</Renderer>
    </div>
  );
}

export default Router;
