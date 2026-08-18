---
"@flemo/core": patch
"@flemo/react": patch
---

Keep transition-adjacent scrolling responsive and reject cross-axis touch jitter before page-wide swipe-back can claim or cancel into an unintended pop.

During push and replace transitions, Flemo suppresses React `click` activation only. Native listeners are not part of this guarantee, and lower-level pointer and mouse events remain observable so the browser can preserve native scroll targeting across the transition.
