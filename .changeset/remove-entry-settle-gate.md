---
"@flemo/react": minor
---

Start a cold push's motion immediately: the content-settle gate no longer holds the entry until data lands, removing the ~300ms-plus tap-to-motion delay on skeleton screens. The stall re-anchoring and clock-cap machinery shipped since the gate was introduced bounds a mid-flight data commit to at most a two-frame hold, verified jank-free on device with the gate off. The framework-neutral gate (`contentSettle`) remains available in @flemo/core for bindings that prefer the arrive-complete trade.
