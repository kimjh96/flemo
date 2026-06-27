---
"@flemo/react": patch
---

Fix consumer `position: fixed` overlays (e.g. bottom sheets) jumping or flashing across the screen during transitions. The content layer is now promoted with `will-change: opacity` instead of a transform, so it no longer establishes a containing block that re-parents those overlays into the scrollable content box mid-transition. Overlays stay pinned to the screen and ride the transition cleanly.
