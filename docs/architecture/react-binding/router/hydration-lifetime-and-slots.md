# Hydration, lifetime, and slots

## Hydration marker

`data-flemo-router` is the transition-boundary marker the engine uses to scope `<Part>` collection. It is useId-based but withheld until after hydration. useId encodes position from the hydration root; different server/client roots would otherwise cause a hydration mismatch when the flemo attribute reaches the DOM.

## Lifetime and runtime

Set `stores.life.alive` in a layout effect. A passive effect runs after reveal paints; a traversal task in that interval could treat a visible zone as dead and skip its transition.

Prewarm/offloader effects involve `ensureGpuPipelinePrewarm` (one-shot boot) and `ensureImageDecodeOffloader`. Image-decode offload is gated by the profile's `imageDecodeOffload` on the image rather than the device. Core's `startFlemoRuntime()` owns this machinery; Router starts it on mount and releases it on unmount.

## Slots

`findSlotRoutes` walks static JSX for a `<Slot>`. With a Slot, `children` is persistent chrome and the Slot renders the stack. Without one, children are routes.
