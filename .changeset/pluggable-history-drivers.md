---
"@flemo/core": minor
---

Expose pluggable history drivers. `createNavigationController` / `createHistorySync` can now run against an injected `HistoryDriver` instead of the browser History API: `createBrowserHistoryDriver` (the default) or `createMemoryHistoryDriver` for a local, in-memory stack.
