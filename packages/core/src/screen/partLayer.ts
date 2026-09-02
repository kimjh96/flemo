import type { NavigateStoreApi } from "@navigate/store";

import isServer from "@utils/isServer";

import { PART_LAYER_ATTR } from "@dom/attributes";

// THE PART LAYER.
//
// A shared bar's <Part> cannot cross-fade with its partner while it lives inside
// a screen. Two screens carrying the same bar id each render their own copy of
// that bar in their own container, and that container is an isolated stacking
// context holding the screen's z-index — so the lower screen's part is painted
// under the upper screen's opaque surface. Both parts run, only one is seen.
// Being covered is a property of being a DESCENDANT, so the covered side's
// parts leave for the duration of the flight and come back when it lands.
//
// Deliberately NOT the morph layer, though the shape is the same. A morph
// stages only when a <Morph> pair matches, and it owns that box outright: it
// writes the layer's z-index and mirrors a screen's hold onto it, then strips
// the hold attribute again on landing (see attachMorph's `finish`). A part
// flight has its own lifetime and would have its hold torn out from under it by
// any morph that happened to land first. Two lifetimes, two boxes.
//
// Per Router SCOPE, not per document, for the reason morphLayer states: a
// nested Router renders inside a box of its own, and a document-level layer
// would stage its parts straight out of it.
const layers = new WeakMap<NavigateStoreApi, HTMLElement>();

/**
 * Publish the element a scope's shared-bar parts should be staged in. A binding
 * calls this from its Router lifecycle — the Router is the only thing that knows
 * which box bounds its screens.
 */
export const registerPartLayer = (store: NavigateStoreApi, element: HTMLElement | null): void => {
  if (element) layers.set(store, element);
  else layers.delete(store);
};

/**
 * The layer to stage a flight's bar parts in, creating a document-level fallback
 * for a binding that publishes none. The fallback is correct for a root Router
 * (its screens fill the viewport anyway) and wrong only for a CONTAINED one,
 * which is exactly the case a binding is expected to publish.
 */
export const resolvePartLayer = (store: NavigateStoreApi): HTMLElement | null => {
  if (isServer()) return null;
  const published = layers.get(store);
  if (published?.isConnected) return published;

  let fallback = document.body.querySelector<HTMLElement>(`:scope > [${PART_LAYER_ATTR}]`);
  if (!fallback) {
    fallback = document.createElement("div");
    fallback.setAttribute(PART_LAYER_ATTR, "");
    document.body.appendChild(fallback);
  }
  return fallback;
};
