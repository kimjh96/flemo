---
"@flemo/react": patch
---

Commit a swipe-back on the Router that owns the screen instead of on the page. The binding called `window.history.back()` directly, which is the same thing the driver does for a browser Router and a different history entirely for a memory one: a swipe inside a `history="memory"` stack walked the whole document backwards rather than popping the stack the finger was dragging.
