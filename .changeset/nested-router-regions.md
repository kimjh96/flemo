---
"@flemo/react": minor
"@flemo/core": patch
---

A `<Router>` nested inside another is now a local transition region: it runs its own in-memory history (no browser back/forward, no URL change) and contains its screens to its box via `position: absolute`, so only that region transitions while the surrounding layout (sidebars, headers) persists. A root `<Router>` is unchanged.
