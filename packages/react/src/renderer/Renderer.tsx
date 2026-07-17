import { Children, type PropsWithChildren, type ReactElement } from "react";

import { createScreenSelector, getMatchedPathPattern, matchesPathname } from "@flemo/core";

import ScreenContext from "@screen/ScreenContext";

import ParamsProvider from "@screen/ParamsProvider/ParamsProvider";

import useHistoryStore from "@stores/useHistoryStore";
import useStores from "@stores/useStores";

import type { RouteProps } from "@Route";

function Renderer({ children }: PropsWithChildren) {
  const index = useHistoryStore((state) => state.index);
  const histories = useHistoryStore((state) => state.histories);
  // This Router's bundle, pinned onto each screen's context so screen-scoped
  // consumers stay bound to the OWNING scope even under a nested Router's
  // StoreContext (see ScreenContextProps.navigateStore).
  const stores = useStores();

  // Selection (which screens stack, active/prev/zIndex, transition names) is a
  // pure derivation in @flemo/core; React only matches each screen to its Route
  // child for `routePath` and mounts it.
  return createScreenSelector(histories, index).map((selection) => {
    const [child] = Children.toArray(children).filter((routeChild) =>
      matchesPathname((routeChild as ReactElement<RouteProps>).props.path, selection.pathname)
    );

    // An entry no declared Route matches cannot mount a screen. It should not
    // exist (the sync fences traversals to the Router's route space), but a
    // corrupted or foreign entry must degrade to "not rendered", never crash
    // the whole stack on `child.props` of undefined.
    if (!child) return null;

    return (
      <ScreenContext.Provider
        key={selection.id}
        value={{
          ...selection,
          navigateStore: stores.navigate,
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
