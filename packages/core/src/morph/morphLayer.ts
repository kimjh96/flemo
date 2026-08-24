import type { NavigateStoreApi } from "@navigate/store";

import isServer from "@utils/isServer";

import { MORPH_LAYER_ATTR } from "@dom/attributes";

// THE FLIGHT LAYER.
//
// A shared element cannot travel while it lives inside a screen. Its screen
// clips it (flemo's own scope is a scroll container by default), covers it
// (an opaque arrival paints over the element it is trading with), and drags it
// (a sliding transition carries it along). Every one of those is a property of
// being a DESCENDANT, so the element leaves for the duration of the flight and
// comes back when it lands.
//
// The layer is per Router SCOPE, not per document: a nested Router renders
// inside a box of its own, and a document-level layer would fly its shared
// elements straight out of it.
const layers = new WeakMap<NavigateStoreApi, HTMLElement>();

/**
 * Publish the element a scope's flights should be staged in. A binding calls
 * this from its Router lifecycle — the Router is the only thing that knows
 * which box bounds its screens.
 */
export const registerMorphLayer = (store: NavigateStoreApi, element: HTMLElement | null): void => {
  if (element) layers.set(store, element);
  else layers.delete(store);
};

/**
 * The layer to stage a flight in, creating a document-level fallback for a
 * binding that publishes none. The fallback is correct for a root Router (its
 * screens fill the viewport anyway) and wrong only for a CONTAINED one, which
 * is exactly the case a binding is expected to publish.
 */
export const resolveMorphLayer = (store: NavigateStoreApi): HTMLElement | null => {
  if (isServer()) return null;
  const published = layers.get(store);
  if (published?.isConnected) return published;

  let fallback = document.body.querySelector<HTMLElement>(`:scope > [${MORPH_LAYER_ATTR}]`);
  if (!fallback) {
    fallback = document.createElement("div");
    fallback.setAttribute(MORPH_LAYER_ATTR, "");
    document.body.appendChild(fallback);
  }
  return fallback;
};
