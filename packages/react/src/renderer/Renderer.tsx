import { Children, type PropsWithChildren, type ReactElement } from "react";

import { pathToRegexp } from "path-to-regexp";

import { createScreenSelector, getMatchedPathPattern } from "@flemo/core";

import ScreenContext from "@screen/ScreenContext";

import ParamsProvider from "@screen/ParamsProvider/ParamsProvider";

import useHistoryStore from "@stores/useHistoryStore";

import type { RouteProps } from "@Route";

function Renderer({ children }: PropsWithChildren) {
  const index = useHistoryStore((state) => state.index);
  const histories = useHistoryStore((state) => state.histories);

  // Selection (which screens stack, active/prev/zIndex, transition names) is a
  // pure derivation in @flemo/core; React only matches each screen to its Route
  // child for `routePath` and mounts it.
  return createScreenSelector(histories, index).map((selection) => {
    const [child] = Children.toArray(children).filter((routeChild) =>
      pathToRegexp((routeChild as ReactElement<RouteProps>).props.path as string).regexp.test(
        selection.pathname
      )
    );

    return (
      <ScreenContext.Provider
        key={selection.id}
        value={{
          ...selection,
          routePath: getMatchedPathPattern(
            (child as ReactElement<RouteProps>).props.path,
            selection.pathname
          )
        }}
      >
        <ParamsProvider>{child}</ParamsProvider>
      </ScreenContext.Provider>
    );
  });
}

export default Renderer;
