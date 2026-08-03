import { Children, useContext, type PropsWithChildren, type ReactElement } from "react";

import { createScreenSelector, getMatchedPathPattern, matchesPathname } from "@flemo/core";

import ScreenContext from "@screen/ScreenContext";

import ParamsProvider from "@screen/ParamsProvider/ParamsProvider";

import useHistoryStore from "@stores/useHistoryStore";
import useStores from "@stores/useStores";

import RouterIdContext from "../RouterIdContext";

import type { RouteProps } from "@Route";

function Renderer({ children }: PropsWithChildren) {
  const index = useHistoryStore((state) => state.index);
  const histories = useHistoryStore((state) => state.histories);
  // This Router's bundle, pinned onto each screen's context so screen-scoped
  // consumers stay bound to the OWNING scope even under a nested Router's
  // StoreContext (see ScreenContextProps.navigateStore).
  const stores = useStores();
  // The screen ENCLOSING this Router, when it is nested. While any enclosing
  // screen rests deep in ITS stack, this Router's whole subtree is covered —
  // its own top included — so the resting flag composes down. Without this, a
  // deep outer screen's inner-active decorator and parts kept following the
  // outer navigation's status flips: measured in the playground, one push at
  // depth ~10 flipped ten covered decorators through PUSHING→COMPLETED.
  // At the root there is no enclosing screen and the default context's
  // isPrev=false leaves the selection untouched.
  const enclosing = useContext(ScreenContext);
  // This Renderer's Router identity — every screen it mounts is OWNED by it.
  const routerId = useContext(RouterIdContext);

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
          isPrev: selection.isPrev || enclosing.isPrev,
          navigateStore: stores.navigate,
          routerId: routerId ?? undefined,
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
