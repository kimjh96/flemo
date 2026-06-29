---
"@flemo/react": minor
"@flemo/core": minor
---

Let a Router run on a custom history backend. Router accepts a `createDriver` factory, and HistoryDriver gains `readPathname()`, so the Router reads and writes the URL only through its driver. A wrapper (e.g. a locale-aware driver that keeps a `/ko` prefix in the address bar while the Router matches unprefixed paths) can now own the whole URL surface without the Router touching window.location directly.
