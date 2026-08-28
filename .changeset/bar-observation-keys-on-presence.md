---
"@flemo/react": patch
---

Key a shared bar's height observation on whether the screen has that bar rather than on the identity of the node passed to `sharedTopBar` or `sharedBottomBar`. A screen that re-renders no longer disconnects and re-attaches the bar's ResizeObserver or forces a layout read in the pre-paint window on every one of those renders.
