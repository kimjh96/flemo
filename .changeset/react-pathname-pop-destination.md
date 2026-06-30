---
"@flemo/react": patch
"@flemo/core": patch
---

Make usePathname report a pop's destination immediately, consistent with push. The history store tracks a `pendingIndex` that advances to the target as soon as a pop starts (the render index still lags on the leaving screen until the transition resolves), and usePathname reads it. A browser Back no longer leaves chrome (active nav highlight, breadcrumbs) on the old route until the back animation finishes.
