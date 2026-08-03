import { useContext, type ComponentPropsWithRef, type PropsWithChildren } from "react";

import { useStore } from "zustand";

import type { PartTransitionName } from "@flemo/core";

import useScreen from "@screen/useScreen";

import useStores from "@stores/useStores";

import RouterIdContext from "../RouterIdContext";

export interface PartProps extends PropsWithChildren<ComponentPropsWithRef<"div">> {
  // The registered createPartTransition `name` to run on this element.
  name: PartTransitionName;
}

// Wraps a specific element and runs a named part-transition on it, driven by
// the screen's lifecycle. Programmatic transitions are driven by the compiled
// `@keyframes` the bar selector emits (compositor, no React re-render); the
// status / active the screen scope exposes are mirrored onto the wrapper so the
// right variant matches. Selective by design: only the wrapped child animates,
// the rest of the bar stays put.
function Part({ ref, name, style, children, ...props }: PartProps) {
  const { isActive, isPrev, navigateStore, routerId: screenRouterId } = useScreen();
  // The part's OWNING Router, stamped on the element so the engine can scope
  // a flight's choreography without structure guesses even for parts OUTSIDE
  // any screen (a persistent header next to a <Slot>, a portal). Inside a
  // screen the ENCLOSING screen's owner wins (a part in a nested Router's
  // chrome belongs to the outer flight); outside one, the nearest Router.
  const nearestRouterId = useContext(RouterIdContext);
  const ownerRouterId = screenRouterId ?? nearestRouterId ?? undefined;

  // The status must come from the Router that OWNS the enclosing screen. Inside
  // a nested <Router>'s chrome the nearest bundle is the inner Router's, so a
  // Part there would otherwise follow the wrong scope's transitions. The
  // nearest bundle stays as the fallback for a Part outside any screen.
  //
  // A part inside a RESTING deep screen (isPrev: below the direct prev) pins
  // its status to a constant, exactly like the screen scope itself does —
  // without the pin every navigation flipped every stacked screen's parts
  // through PUSHING→COMPLETED (measured: an O(depth) attribute-write storm on
  // elements nothing can see). Role changes arrive through the screen
  // context, which re-renders and re-evaluates the pin.
  const stores = useStores();
  const status = useStore(navigateStore ?? stores.navigate, (state) =>
    isPrev ? "COMPLETED" : state.status
  );

  return (
    <div
      ref={ref}
      data-flemo-part-name={name}
      data-flemo-router={ownerRouterId}
      data-flemo-status={status}
      data-flemo-active={isActive ? "true" : "false"}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export default Part;
