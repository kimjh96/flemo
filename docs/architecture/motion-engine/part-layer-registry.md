# Part-layer registration and fallback

`packages/core/src/screen/partLayer.ts` provides the shared-bar part-layer registry. Read it alongside [shared-bar staging and swipe lifecycle](staging-and-swipe.md), which describes moving and restoring Parts.

## Scope and lifetime

The registry is a `WeakMap<NavigateStoreApi, HTMLElement>`. A binding calls `registerPartLayer(store, element)` from its Router lifecycle because the Router knows the box that bounds its screens. Passing an element replaces the store's registration; passing `null` deletes it. Registration does not move or remove DOM nodes.

The part layer is separate from the morph layer. Shared-bar Parts leave their screen's stacking context so the covered side can remain visible during a transition. Morph staging owns its own layer styling and hold lifetime; sharing that layer could let a morph's landing remove a hold still needed by a Part transition.

## Resolution

`resolvePartLayer(store)` behaves as follows:

1. Return `null` on the server.
2. Return the registered element if it is connected.
3. Otherwise, reuse the first direct child of `document.body` bearing `PART_LAYER_ATTR`.
4. If no such child exists, append a `div` bearing that attribute to `document.body` and return it.

The fallback is document-level and can be shared by stores without a connected published layer. It is not inserted into the per-store registry. A disconnected registered element remains registered but is bypassed during resolution.

The source describes this fallback as suitable for a root Router whose screens fill the viewport. A contained Router must publish its own bounded layer; the document-level fallback would stage Parts outside its box.

## Evidence boundary

This module creates only the fallback element and marker. It does not set layer geometry, stacking, pointer behavior, or hold attributes, and it contains no fallback-removal operation. Staging behavior belongs to its callers and helpers. The supplied source establishes registry and resolution behavior, not whether every binding registers correctly or whether browser tests pass.
