# Stores and history

Create one `FlemoStores` bundle per Router through core's `createRouterScope`. Seed it in a `useState` initializer so zustand supplies it to React as the SSR snapshot. A `<RouterScopeProvider>` above a root Router may host the bundle for inspector access; nested Routers always own a local bundle.

`history="browser"` is the default, including for nested Routers. It drives `window.history` through a keyed `HistoryDriver`. `createDriver` can override it, for example with a locale wrapper. `history="memory"` uses an isolated stack.

A nested browser Router derives its key from the parent key and enclosing screen's entry id. Unlike useId, this key is stable on re-entry. Its scope persists across destruction/recreation so browser Back into its zone resumes the same stack. `seedRouterEntry` stamps the mount entry.

`HistoryListener` is a thin popstate-to-navigation bridge; core's `ensureScopeHistorySync` owns the logic.
