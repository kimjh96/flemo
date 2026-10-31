# Router initialization and committed configuration

These observations cover the supplied `packages/react/src/Router.tsx`; no browser or automated validation was performed. See [stores and history](../stores-and-history.md), [scope publication](../scope-targeting-and-publication.md), and [hydration and lifetime](../hydration-lifetime-and-slots.md).

## Initial location and entry identity

Router defaults to `initPath="/"`, `defaultTransitionName="cupertino"`, browser history, and `strictRoutes=false`. A state initializer creates the browser driver once; memory mode does not invoke that factory. A hosted root passes no Router key to the factory; an independently owned Router passes its key.

Only a client root browser Router reads its initial pathname through the browser driver. Nested Routers and memory roots use `initPath`. Router separates an embedded query from the chosen location before route matching. Search comes directly from `window.location.search` for a client root browser Router and from the chosen location's embedded query otherwise. The implementation therefore does not delegate every initial URL channel to a custom driver.

A `useSyncExternalStore` probe returns true for server and hydration snapshots and false for subsequent client snapshots. Router captures the initial value and passes it to `createRouterScope` as `deferEntryAdoption`. If deferred, a layout effect calls `adoptEntryIdentity(stores)`, keeping browser-history entry identity out of the hydration render, where the server cannot know it. The helper's internal guards are outside the supplied source.

The separate `data-flemo-router` identity remains withheld until a passive effect exposes it, as described in the hydration guide. Entry adoption and Router-marker exposure are distinct operations.

A passive effect stamps browser entries through `seedRouterEntry`; memory mode skips this. Nested browser scope persistence is requested only for a non-hosted nested browser Router. Root hosting and nested persistence are separate paths.

## History synchronization and committed configuration

The executable JSX mounts `HistoryListener` unconditionally inside the store provider, including for memory Routers. This conflicts with a preceding comment claiming memory Routers run no bridge. The inline explanation attributes the unconditional mount to synchronous driver-backed swipe commits; Router source alone does not verify the listener implementation or gesture timing.

The scope node stores `depth` at initialization. Its name is a navigation lookup key, separate from the derived history key. Duplicate ancestor names trigger a development warning from an effect; the source describes resolution as preferring the nearer matching Router. Renaming does not change the history key.

Scope configuration publishes in the insertion phase. The notifying default-transition store publishes in the layout phase only when its value changes. A descendant navigating from its own layout effect in the commit that changes the default can therefore still use the previous default. This documented residual timing window is distinct from the scope-node publication guarantee.

Transition, decorator, Part, and Morph registrations pass to `useTransitionStyles`. Router comments describe insertion-phase style installation, but the hook implementation is not supplied here. The default transition belongs to navigation, not an individual Route.
