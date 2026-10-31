# Part-layer registration and fallback

`packages/core/src/screen/partLayer.ts` provides the shared-bar part-layer registry. See [shared-bar staging and swipe lifecycle](staging-and-swipe.md) for moving and restoring Parts.

## Scope and lifetime

The registry is a `WeakMap<NavigateStoreApi, HTMLElement>`. A binding calls `registerPartLayer(store, element)` from its Router lifecycle because the Router knows its screens' bounding box. Passing an element replaces the store's registration; passing `null` deletes it. Registration neither moves nor removes DOM nodes.

The part layer is separate from the morph layer. Shared-bar Parts leave their screen's stacking context so the covered side can remain visible during a transition. Morph staging owns its layer styling and hold lifetime; sharing that layer could let a morph's landing remove a hold still needed by a Part transition.

## Resolution

`resolvePartLayer(store)`:

1. Returns `null` on the server.
2. Returns the registered element if connected.
3. Otherwise, reuses the first direct child of `document.body` bearing `PART_LAYER_ATTR`.
4. If none exists, appends a `div` bearing that attribute to `document.body` and returns it.

The document-level fallback can be shared by stores without a connected published layer. It is not added to the per-store registry. A disconnected registered element remains registered but is bypassed during resolution.

The source describes the fallback as suitable for a root Router whose screens fill the viewport. A contained Router must publish its own bounded layer; the document-level fallback would stage Parts outside its box.

## Evidence boundary

This module creates only the fallback element and marker. It does not set layer geometry, stacking, pointer behavior, or hold attributes, and has no fallback-removal operation. Staging behavior belongs to callers and helpers. The supplied source establishes registry and resolution behavior, not whether every binding registers correctly or browser tests pass.
