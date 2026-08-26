---
"@flemo/react": patch
---

Keep a screen's stacking to itself while a `position: fixed` overlay still reaches the viewport. Screen containers isolate and carry their stack position, so a covered screen's dim and a consumer's own `z-index` can no longer paint over the screen that replaced them, and a bottom sheet in a nested Slot still covers the surrounding shared bars.
