---
"@flemo/web": patch
---

Docs: document the `skip` / `until` options in the Navigation options table, add a `useScreen` return-shape reference to the API page, expand the Screen safe-areas guidance for native/hybrid (WebView) apps — let the web own the safe areas via `statusBarHeight` / `systemNavigationBarHeight` while the native shell disables its own — and reframe the server-side rendering section away from Next.js, since flemo owns client-side history and doesn't compose with the Next.js App Router.
