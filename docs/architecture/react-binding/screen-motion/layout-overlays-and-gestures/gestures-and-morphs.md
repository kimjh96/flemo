# Gesture and morph lifetime

The stable controller reads current transition and screen state through `swipeEnvRef`. Readiness requires a non-root active screen, COMPLETED navigation, IDLE drag status, resolved swipe options, and viewport scroll height below 10.

Pointer handlers forward native events, including lost pointer capture. The non-passive touchmove listener prevents default only when the controller requests it. Effect cleanup removes the listener and calls `abandon`, including when Activity disconnects effects.

A committed swipe calls the owning Router's `stores.driver.back()`, preserving the selected Router backend without directly calling browser history.

At drag start, settle any retained morph handle with `(false, 0)` before calling `beginMorphSwipe(stores.navigate, "POPPING")`. Progress calls `scrub`; settlement forwards the commit verdict and duration, then clears the ref. These callbacks establish integration and orphan-handle recovery at the next start, not independent proof of the imported controller's teardown behavior.

Resolve transitions quietly during render and again in an effect for diagnostics. Resolve swipe options through `resolveSwipeOptions`, supporting the resolver's accepted authoring forms rather than reading only a legacy direction field.
