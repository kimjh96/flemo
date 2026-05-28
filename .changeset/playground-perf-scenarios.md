---
"@flemo/web": patch
---

Add a "Perf scenarios" section to the playground's Library screen that pushes a synthetic Heavy Arrival screen with adjustable render-body CPU and tree size. Backs the new `heavy-screen.spec.ts` A/B harness measuring flipLatency, rAF cadence, and `long-animation-frame` entries with and without the compositor isolation hints.
