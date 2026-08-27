import {
  attrSelector,
  attrValueSelector,
  BAR_RIDING_ATTR,
  LAYER_HOST_ATTR,
  LAYER_OWNER_ATTR,
  LAYER_SLOT_ATTR,
  SCREEN_ATTR
} from "@dom/attributes";

// WHAT RIDES BESIDE A SCREEN.
//
// Two element classes live beside a scope rather than inside it and have to
// move when it moves: a riding shared bar, and a `<Layer>` overlay. They came
// from opposite directions and end up needing the identical treatment — the
// compiled rule pairs them with the screen rule, the gesture mirrors every
// inline write onto them, and the engine promotes them for the flight and
// demotes them off-cadence afterwards.
//
// They differ in exactly one thing: WHERE they are.
//
// A bar never leaves the container it belongs to, so walking that container
// finds it. An overlay does leave — that is the entire point of it, since a
// bar declared by an ancestor screen is outside the descendant's box and an
// overlay that must cover the bar has to be outside it too. So an overlay is
// found the other way round: it names its owner, and the owner's scope carries
// the id it names.
//
// This module is where both facts live, so the three drivers cannot end up
// with three different ideas of what rides.

/** A container's own direct child matching a selector, never a descendant. */
const ownChild = (container: HTMLElement | null, selector: string): HTMLElement | null => {
  if (!container) return null;
  for (const child of Array.from(container.children)) {
    const element = child as HTMLElement;
    if (typeof element.matches === "function" && element.matches(selector)) return element;
  }
  return null;
};

/**
 * The `<Layer>` overlays that move with the screen in this container.
 *
 * Two shapes, because a host is inherited. A screen that renders its OWN host
 * moves everything portaled into it by moving that one box. A screen NESTED
 * inside such a host has its overlays in a container that is not its own, and
 * no walk of its subtree can find them — so they are matched by the owner id
 * they carry.
 *
 * Never both: driving a host and the slots inside it would compose the two
 * writes and send the overlay twice as far as its screen.
 */
export const collectLayerRiders = (container: HTMLElement | null): HTMLElement[] => {
  if (!container) return [];

  const host = ownChild(container, attrSelector(LAYER_HOST_ATTR));
  if (host) return [host];

  const scope = ownChild(container, attrSelector(SCREEN_ATTR));
  const screenId = scope?.getAttribute(SCREEN_ATTR);
  if (!screenId) return [];

  return Array.from(
    document.querySelectorAll<HTMLElement>(
      attrSelector(LAYER_SLOT_ATTR) + attrValueSelector(LAYER_OWNER_ATTR, screenId)
    )
  );
};

/**
 * Whether an element beside a scope is riding this flight.
 *
 * A bar rides only when its partner screen does not own it, so it says so with
 * an attribute the binding flips per flight. An overlay has exactly one screen
 * and always leaves with it, so being a host or a slot is the whole answer.
 */
export const isRider = (element: HTMLElement | null | undefined): element is HTMLElement => {
  if (!element) return false;
  if (element.getAttribute(BAR_RIDING_ATTR) === "true") return true;
  return element.hasAttribute(LAYER_HOST_ATTR) || element.hasAttribute(LAYER_SLOT_ATTR);
};
