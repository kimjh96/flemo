---
"@flemo/core": minor
"@flemo/react": minor
"@flemo/react-layout": patch
"@flemo/web": patch
---

Make the navigation stores request-scoped so screens render during SSR. The
history/navigate/transition/screen stores are no longer module-level singletons
shared across every SSR request; the Router now creates one bundle per mount,
seeds it from `initPath`, and provides it via context. Because the seed is the
store's initial state, zustand hands it to React as the server snapshot, so the
screen stack paints on the server (previously the root was empty until the
client mounted) and each concurrent request keeps its own stack.

The public API (`Router`, `Route`, `useNavigate`, `useParams`, `useScreen`,
`Screen`, `LayoutScreen`) is unchanged. Internally, `@flemo/core` now exposes the
stores as `createHistoryStore` / `createNavigateStore` / `createTransitionStore`
factories instead of singleton hooks.
