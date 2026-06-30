---
"@flemo/react": minor
---

Add `<Layer>`: lift an overlay (bottom sheet, dim backdrop, FAB, toast) out of a screen's content-isolation box up to the scope level, so it floats over the screen and rides the transition instead of being trapped (and flashed mid-transition) inside the inset, scrollable content box. Put it inside a reusable overlay component once and every call site gets the escape for free; outside a `<Screen>` it renders in place. This resolves the backdrop / overlay / WebKit trilemma: the content layer keeps `backdrop-filter` working while overlays escape via `<Layer>`.
