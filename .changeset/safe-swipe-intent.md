---
"@flemo/core": patch
"@flemo/react": patch
---

Keep transition-adjacent scrolling responsive and reject cross-axis touch jitter before page-wide swipe-back can claim or cancel into an unintended pop.

During push and replace transitions, Flemo suppresses `click` activation for React handlers and native click listeners below the React root. Listeners above the root, plus lower-level pointer and mouse events, remain observable so the browser can preserve native scroll targeting across the transition.
