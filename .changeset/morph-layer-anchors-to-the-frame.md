---
"@flemo/react": patch
---

Anchor the flight layer to the app's own frame instead of the viewport. A root Router's layer was fixed, on the reasoning that a root Router owns the screen — but that is one deployment of a root Router, not the only one. Mounted inside a bounded frame (a device preview, an embedded region, a modal) the viewport is not its box, so a shared element in flight painted straight through the frame's rounded corners while every screen inside it stayed clipped. The layer is now absolute in both cases, sharing whatever box — and whatever clip — the app gave its screens.
