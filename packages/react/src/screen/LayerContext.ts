import { createContext, useContext } from "react";

// The two halves of a <Layer>, kept apart because they come from two different
// screens.
//
// The HOST comes from the OUTERMOST screen in the chain and is inherited all
// the way down. An overlay has to clear the chrome of every screen above its
// own, and chrome declared by an ancestor is rendered outside that ancestor's
// scope — so a host in a nested screen's own container is already one box too
// deep to reach it. Measured: a sheet hosted in a nested container still lost
// to the tab bar declared by the screen holding the <Slot>.
//
// The OWNER comes from the NEAREST screen and is overwritten at every level.
// It is what stops the hoist from turning the overlay into an orphan: the slot
// leaves the screen's box for paint order only and carries everything else
// about being that screen with it.
//
// Splitting them is the whole design. #344 had only the host, so every nested
// screen shared one target with no way to tell whose overlay was whose, and
// the escape kept painting after its screen was covered, outlived its screen's
// exit, and escaped the nested Router's clip.

/**
 * The element a `<Layer>` portals into. Null before the outermost screen
 * mounts and on the server, where no host element exists yet — a `<Layer>`
 * renders nothing until it has a target.
 */
const LayerHostContext = createContext<HTMLElement | null>(null);

export function useLayerHost() {
  return useContext(LayerHostContext);
}

/** Everything a slot needs to keep being its screen while sitting outside it. */
export interface LayerOwner {
  /**
   * The owning screen's stack position. Two screens' overlays then order the
   * way their screens do, rather than by whichever portal mounted first.
   */
  zIndex: number;
  /**
   * The owner's paint state. `visibility: hidden` on the screen container is
   * plain CSS and stops at that container's own descendants, so a slot in
   * another box has to be told. Without it a covered screen's overlay is the
   * one thing still painting — for the whole debounce window before the freeze
   * catches up (see ScreenFreeze.portal.test.tsx).
   */
  paintHidden: boolean;
  /** The transition, status and active flags the compiled slot rule selects on. */
  transitionName: string;
  status: string;
  isActive: boolean;
  /**
   * The owner's animation hold. The slot pauses at the same from-pose as the
   * screen, so a flight that is held opens with its overlay rather than after
   * it.
   */
  animHold: string;
  /**
   * Whether this owner is ALSO the screen that renders the host.
   *
   * An overlay has to travel with whatever is actually moving under it, and
   * that is not always its owner. When an ancestor screen flies — a push on an
   * outer Router, with the owner sitting inside it at rest — the thing that
   * moves is the ancestor, and the host is inside the ancestor's container. So
   * the HOST rides the screen that renders it, and a slot rides its owner only
   * when the two are different screens. Otherwise the pair would both animate
   * and the overlay would travel twice as far as its screen.
   *
   * Measured in a consumer app before this existed: a sheet in a nested screen
   * sat perfectly still while the whole region slid out from under it, because
   * its owner's status was IDLE for the entire flight and the compiled rule had
   * nothing to match.
   */
  rendersHost: boolean;
}

const LayerOwnerContext = createContext<LayerOwner | null>(null);

export function useLayerOwner() {
  return useContext(LayerOwnerContext);
}

export { LayerHostContext, LayerOwnerContext };
