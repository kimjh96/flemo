import { Children, type PropsWithChildren, type ReactElement } from "react";

import { pathToRegexp } from "path-to-regexp";

import useHistoryStore from "@history/store";

import ParamsProvider from "@screen/ParamsProvider/ParamsProvider";
import ScreenContext from "@screen/ScreenContext";

import type { RouteProps } from "@Route";

function Renderer({ children }: PropsWithChildren) {
  const index = useHistoryStore((state) => state.index);
  const histories = useHistoryStore((state) => state.histories);

  return histories
    .map((history) =>
      Children.toArray(children).filter((child) =>
        pathToRegexp((child as ReactElement<RouteProps>).props.path as string).regexp.test(
          history.pathname
        )
      )
    )
    .map(([child], zIndex) => (
      <ScreenContext.Provider
        key={histories[zIndex].id}
        value={{
          id: histories[zIndex].id,
          isActive: zIndex === index,
          isRoot: zIndex === 0,
          isPrev: zIndex < index - 1,
          zIndex,
          pathname: histories[zIndex].pathname,
          params: histories[zIndex].params,
          transitionName: histories[index].transitionName,
          prevTransitionName: histories[index - 1]?.transitionName,
          layoutId: histories[zIndex].layoutId
        }}
      >
        <ParamsProvider active={zIndex === index} params={histories[zIndex].params}>
          {child}
        </ParamsProvider>
      </ScreenContext.Provider>
    ));
}

export default Renderer;
