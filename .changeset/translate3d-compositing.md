---
"@flemo/core": patch
---

Compile x/y offsets to translate3d instead of translateX/translateY (keyframes, entering initial styles, and inline swipe animations alike). Chromium pixel-snaps a 2D-transform-animated layer when its content rasters heavily, repeating a frame roughly every six and catching up with a double-length jump — a visible stutter across the whole transition on gradient-heavy screens. The 3D form routes the layer through texture-filtered compositing, which glass-recorded A/B shows sliding monotonically to rest. WebKit behaves identically for both forms; curves, timings, and the API are unchanged.
