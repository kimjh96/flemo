---
"@flemo/core": minor
"@flemo/react": patch
---

Fix a React hydration mismatch on server-rendered screens: the scope's
`will-change: transform` promotion is derived from browser-only state
(`flemo:preraster`, the steady-60 desktop profile), so it is now deferred past
hydration instead of being evaluated in the hydration render — the server HTML
and the first client render always agree, and the promotion still lands before
any transition can start. Core exports `readLayerPromotionFlag`, the single
predicate both halves of that decision now read.
