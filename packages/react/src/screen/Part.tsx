import { useContext, type ComponentPropsWithRef, type PropsWithChildren } from "react";

import { useStore } from "zustand";

import type { PartTransitionName } from "@flemo/core";

import useScreen from "@screen/useScreen";

import useStores from "@stores/useStores";

import RouterIdContext from "../RouterIdContext";

export interface PartProps extends PropsWithChildren<ComponentPropsWithRef<"div">> {
  /** The registered `createPartTransition` name to run on this element. */
  name: PartTransitionName;
}

/**
 * Animates one named element inside a screen or inside a shared bar.
 *
 * Only the wrapped element moves; the rest of the bar stays put. The element
 * follows the transition of the Router that handles the ENCLOSING screen, so a
 * Part in a nested Router's header or tab bar follows the outer transition, and
 * a Part outside every screen follows the nearest Router.
 *
 * A Part that sets only its variant values follows the swipe of an interactive
 * pop automatically and inherits the matching duration and delay of the screen
 * it is in. Easing never inherits: set the screen transition's easing on a Part
 * that must stay at the same point along its path as the screen during both a
 * programmatic pop and a swipe.
 */
// Programmatic transitions are driven by the compiled `@keyframes` the bar
// selector emits (compositor, no React re-render); the status / active the
// screen scope exposes are mirrored onto the wrapper so the right variant
// matches.
function Part({ ref, name, style, children, ...props }: PartProps) {
  const { isActive, isPrev, navigateStore, routerId: screenRouterId, transitionName } = useScreen();
  // The part's OWNING Router, stamped on the element so the engine can scope
  // a transition's choreography without structure guesses even for parts OUTSIDE
  // any screen (a persistent header next to a <Slot>, a portal). Inside a
  // screen the ENCLOSING screen's owner wins (a part in a nested Router's
  // chrome belongs to the outer transition); outside one, the nearest Router.
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
      // The running transition's definition, so the compiled rule can hand this part the
      // clock that transition runs at rather than the zero an omitted duration
      // resolves to (see resolvePartTiming). It is the ENCLOSING screen's, for
      // the same reason the status below is: a part in a nested Router's chrome
      // belongs to the outer transition. Absent outside any screen, where there is
      // no transition to inherit from and the by-name rule keeps what was authored.
      data-flemo-transition={transitionName}
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
