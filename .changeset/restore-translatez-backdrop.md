---
"@flemo/react": patch
---

Keep consumer `backdrop-filter` rendering during transitions. The content-isolation layer now promotes with `transform: translateZ(0)` instead of `will-change: opacity`, so a frosted header inside a screen no longer washes out mid-transition.
