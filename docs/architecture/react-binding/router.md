# Router

`src/Router.tsx` owns React wiring for Router scope, history, and lifetime.

## Stores and history

Create one `FlemoStores` bundle per Router through core's `createRouterScope`, seeded in a `useState` initializer so zustand supplies it to React as the SSR snapshot. A `<RouterScopeProvider>` above a root Router may host the bundle for inspector access; nested Routers always own a local bundle.

`history="browser"` is the default, including for nested Routers. It drives `window.history` through a keyed `HistoryDriver`; `createDriver` can override it, for example with a locale wrapper. `history="memory"` uses an isolated stack.

A nested browser Router derives its key from the parent key and enclosing screen's entry id. Unlike useId, this is stable on re-entry. Its scope persists across destruction/recreation so browser Back into its zone resumes the same stack. `seedRouterEntry` stamps the mount entry. `HistoryListener` is a thin popstate-to-navigation bridge; core's `ensureScopeHistorySync` owns the logic.

## Scope targeting and publication

Through `RouterScopeContext` and `RouterTarget.ts`, each Router publishes a `RouterScopeNode` containing `name`, `stores`, `routePaths`, `strictRoutes`, and `parent`. `useNavigate` can target beyond the nearest Router using `router: "current" | "parent" | "root" | "nearest-owner" | "<name>"`. Use `{ name }` or `{ scope }` when a name collides with a keyword.

`RegisterRouter` augmentation controls accepted navigation names: an empty registry permits any string; a non-empty registry restricts names to `keyof RegisterRouter`, making typos compile errors. The `@ts-expect-error` block in `useNavigate.routerTarget.test.tsx` guards this narrowing: tsc reports an unused directive if it regresses. The Router `name` prop remains `string`, analogous to `<Route path>` versus `push()`.

Create the node identity once and refresh it in place so the extra provider causes zero re-renders. Refresh through `publishRouterConfig` in an insertion effect:

- Never publish during render: discarded or suspended renders could publish props that no visible screen committed to.
- Publish before the entire layout pass: layout effects run bottom-up, so a descendant redirect in a layout effect would otherwise read the previous commit's configuration.

`defaultTransitionName` has the same discarded-render hazard but publishes in the layout phase. Its store write notifies subscribers, and React forbids scheduling updates from an insertion effect. Guard the write on an actual change: zustand compares the partial by identity, so an unguarded write wakes every subscriber on every commit. Regression tests cover all three windows.

Resolve targets purely and synchronously before queuing any task. The selected scope's stores, driver, `markSelfInduced`, and `life` execute the entire navigation. Development errors therefore reach the caller's stack rather than becoming unhandled rejections.

Check route ownership (`ownsRoute`) for each navigation. An explicit target produces a development throw; an implicit target produces a development warning, preserving legacy behavior unless `strictRoutes` applies. Diagnostics use `@utils/devDiagnostics`, gated on `process.env.NODE_ENV`; vite.config.mts deliberately does not fold that value during the library build.

## Hydration, lifetime, and slots

- `data-flemo-router` is the flight-boundary marker used by the engine to scope `<Part>` collection. It is useId-based but withheld until after hydration: useId encodes position from the hydration root, so different server/client roots would otherwise cause a hydration mismatch on the flemo attribute reaching the DOM.
- Set `stores.life.alive` in a layout effect. A passive effect runs after reveal paints; a traversal task in that interval could treat a visible zone as dead and skip its transition.
- Prewarm/offloader effects involve `ensureGpuPipelinePrewarm` (one-shot boot) and `ensureImageDecodeOffloader`; image-decode offload is gated by the profile's `imageDecodeOffload` on the image rather than the device. Core's `startFlemoRuntime()` owns this machinery; Router starts it on mount and releases it on unmount.
- `findSlotRoutes` walks static JSX for a `<Slot>`. With a Slot, `children` is persistent chrome and the Slot renders the stack. Without one, children are routes.
