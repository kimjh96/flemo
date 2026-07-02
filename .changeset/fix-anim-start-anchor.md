---
"@flemo/core": patch
"@flemo/react": patch
---

Anchor a transition's start to the screen's first painted frame. iOS WebKit starts the animation clock when the style commits, so a heavy entering screen (large list, fetch-on-mount) burned the opening of the transition rasterizing its first frame and the animation visibly skipped ahead; the animation is now held paused for the first two frames and then plays its full duration against already-painted layers.
