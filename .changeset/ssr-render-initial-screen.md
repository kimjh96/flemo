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

Breaking: `@flemo/core` replaces the singleton store hooks `useHistoryStore` /
`useNavigateStore` / `useTransitionStore` with the `createHistoryStore` /
`createNavigateStore` / `createTransitionStore` factories. The common API
(`Router`, `Route`, `useNavigate`, `useParams`, `useScreen`, `Screen`) is
unchanged.
