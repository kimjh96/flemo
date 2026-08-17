---
"@flemo/core": patch
---

Make the `driver=raf` force-pin actually drive the player on desktop Blink. The desktop/high-refresh gate (`maxTouchPoints === 0 || …`) fired before the pin was honored, so a pinned session silently stayed on the compiled tier there — leaving the player+per-frame-snap path (the only tier that can quantize a HiDPI transform to device pixels every frame and kill the sub-pixel convergence shimmer) unreachable on desktop even when explicitly pinned. The pin now bypasses this gate, same as it already bypasses the native-kind choice.
