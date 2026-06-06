---
"@flemo/core": major
"@flemo/react": major
"@flemo/web": patch
---

Make the navigation stores request-scoped so screens render during SSR. The
history/navigate/transition/screen stores are no longer module-level singletons
shared across every SSR request; the Router now creates one bundle per mount,
seeds it from `initPath`, and provides it via context. Because the seed is the
store's initial state, zustand hands it to React as the server snapshot — so the
screen stack paints on the server (previously the root was empty until the
client mounted) and each concurrent request keeps its own stack.

Breaking: `@flemo/core` now exports `createHistoryStore` / `createNavigateStore`
/ `createTransitionStore` factories instead of the singleton hooks. Consume the
React-bound `useHistoryStore` / `useNavigateStore` / `useTransitionStore` /
`useScreenStore` from `@flemo/react` (they read the active Router's stores), or
`useStores()` for imperative access.

To read or drive the stores from outside the `<Router>` (devtools, an inspector
panel beside the screen frame), wrap both in the new `<RouterScopeProvider>`: the
Router adopts the hosted bundle instead of creating its own, so siblings share it.
