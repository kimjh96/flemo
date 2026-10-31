# Router layout and staging layers

These observations cover the supplied `packages/react/src/Router.tsx` and `packages/react/src/screen/PartLayer/PartLayer.tsx`; no browser or automated validation was performed.

## Static Slots and nested regions

`findSlotRoutes` recursively inspects static React element children supplied to Router and selects the first Slot found. It does not execute child components to discover Slots in their rendered output. With a Slot, Router renders the supplied layout; otherwise, it passes children to Renderer. Valid non-Route children without a Slot trigger a development warning to separate routes from persistent layout.

Router depth determines nesting independently of history mode. A nested Router provides a stable contained-viewport context and renders a wrapper defaulting to `position: relative`, `overflow: hidden`, and `isolation: isolate`. Consumer `style` is spread afterward and can override these defaults. Isolation keeps the region's high stacking layers from competing with surrounding page overlays. Root Routers render no wrapper, so this component does not apply their `className` or `style` props.

Root and nested Routers render MorphLayer and PartLayer as siblings of screen content. Nested layers sit inside the region wrapper. Placement follows Router bounds rather than a moving screen's subtree.

`ownsLayers` defaults to false. A nested Router with `ownsLayers=true` resets `LayerHostContext` to null around its content. The declared purpose is for the region's outermost screen to supply a local overlay host instead of inheriting an ancestor screen's host. The source verifies the context reset, not the unseen screen-host implementation. Root rendering has no corresponding conditional reset.

## PartLayer binding contract

PartLayer renders a div marked `data-flemo-part-layer=""`. A layout effect calls `registerPartLayer(stores.navigate, ref.current)`; cleanup calls the same function with null. The effect depends on `stores.navigate`, tying registration to the navigation store's lifetime.

The element uses `position: absolute`, `inset: 0`, and `pointerEvents: none`. It anchors staged Parts to the enclosing frame and accepts no pointer input. The component sets no explicit z-index; see [staging and swipe](../../../motion-engine/staging-and-swipe.md) for core staging behavior.

The layer has `aria-hidden="true"`. Its source explains that staged content duplicates the covered screen while the other screen's bar remains in place, so the travelling duplicate should not be announced. This markup establishes accessibility intent, not an assistive-technology test.

The directory barrel re-exports the component and its props type; this alone does not establish a public export from `@flemo/react`.
