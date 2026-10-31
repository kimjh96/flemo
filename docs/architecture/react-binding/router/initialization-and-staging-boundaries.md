# Router initialization and staging boundaries

This supplement describes the supplied `packages/react/src/Router.tsx` and `packages/react/src/screen/PartLayer/PartLayer.tsx`. Read it alongside [stores and history](stores-and-history.md), [scope publication](scope-targeting-and-publication.md), and [hydration and lifetime](hydration-lifetime-and-slots.md). These are source-level observations; no browser or automated validation was performed for this assessment.

## Initial location and entry identity

Router defaults to `initPath="/"`, `defaultTransitionName="cupertino"`, browser history, and `strictRoutes=false`. A browser driver is created once through a state initializer. Memory mode does not invoke the browser-driver factory. A hosted root passes no Router key to that factory; an independently owned Router passes its key.

Only a root browser Router on the client reads its initial pathname through the browser driver. Nested Routers and memory roots use `initPath`. Router splits an embedded query from the chosen location before route matching. For a client root browser Router, search comes directly from `window.location.search`; otherwise it comes from the query embedded in the chosen location. Thus the visible implementation does not delegate every initial URL channel to a custom driver.

A `useSyncExternalStore` probe returns true for server and hydration snapshots and false for subsequent client snapshots. Router captures that initial value and passes it as `deferEntryAdoption` to `createRouterScope`. If adoption was deferred, a layout effect calls `adoptEntryIdentity(stores)`. This keeps browser-history entry identity out of the hydration render, where the server cannot know it. The helper's internal guards are outside the supplied source.

The separate `data-flemo-router` identity remains withheld until a passive effect exposes it, as described in the hydration guide. Entry adoption and exposure of the Router marker are distinct operations.

Browser entry stamping runs in a passive effect through `seedRouterEntry`; memory mode skips it. Nested browser scope persistence is requested only for a non-hosted nested browser Router. Root hosting and nested persistence are separate paths.

## History synchronization and committed configuration

The executable JSX mounts `HistoryListener` unconditionally inside the store provider, including for memory Routers. A preceding comment claiming memory Routers run no bridge conflicts with that JSX. The inline explanation attributes the unconditional mount to synchronous driver-backed swipe commits; the supplied Router source alone does not verify the listener's implementation or gesture timing.

The scope node also stores `depth` at initialization. Its name is a navigation lookup key, separate from the derived history key. Duplicate ancestor names trigger a development warning from an effect, and the source describes resolution as preferring the nearer matching Router. Renaming does not change the history key.

Scope configuration publishes in the insertion phase, while the notifying default-transition store publishes in the layout phase only when its value changes. A descendant navigating from its own layout effect in the commit that changes the default can therefore still use the previous default. This is a documented residual timing window, distinct from the scope-node publication guarantee.

Transition, decorator, Part, and Morph registrations are passed to `useTransitionStyles`. Router's comments describe insertion-phase style installation, but that hook's implementation is not supplied here. The default transition belongs to navigation, not an individual Route.

## Static slots and nested regions

`findSlotRoutes` recursively inspects the static React element children supplied to Router and selects the first Slot found. It does not execute child components to discover Slots hidden inside their rendered output. With a Slot, Router renders the supplied layout; without one it passes children to Renderer. Valid non-Route children without a Slot produce a development warning directing the caller to separate routes from persistent layout.

Nesting is determined by Router depth, independently of history mode. A nested Router provides a stable contained-viewport context and renders a wrapper whose defaults are `position: relative`, `overflow: hidden`, and `isolation: isolate`. Consumer `style` is spread afterward and can override those defaults. Isolation keeps the region's high stacking layers from competing with surrounding page overlays. Root Routers render no wrapper, so their `className` and `style` props are not applied by this component.

Both root and nested Routers render MorphLayer and PartLayer as siblings of their screen content. Nested layers sit inside the region wrapper. Their placement follows Router bounds rather than a moving screen's subtree.

`ownsLayers` defaults to false. For a nested Router with `ownsLayers=true`, Router resets `LayerHostContext` to null around its content. The declared purpose is to make that region's outermost screen supply a local overlay host instead of inheriting an ancestor screen's host. The source verifies the context reset; it does not independently verify the unseen screen-host implementation. Root rendering has no corresponding conditional reset.

## PartLayer binding contract

PartLayer renders a div marked `data-flemo-part-layer=""`. A layout effect calls `registerPartLayer(stores.navigate, ref.current)` and its cleanup calls the same function with null. The effect depends on `stores.navigate`, binding registration to the navigation store's lifetime.

The element uses `position: absolute`, `inset: 0`, and `pointerEvents: none`. It anchors staged Parts to the enclosing frame and does not accept pointer input. This component sets no explicit z-index; core staging behavior is described separately in [staging and swipe](../../motion-engine/staging-and-swipe.md).

The layer has `aria-hidden="true"`. Its source explains that staged content is the covered screen's duplicate while the other screen's bar remains in place, so the travelling duplicate should not be announced. This markup establishes the component's accessibility intent without claiming an assistive-technology test.

The directory barrel re-exports the component and its props type. It does not by itself establish a public export from `@flemo/react`.
