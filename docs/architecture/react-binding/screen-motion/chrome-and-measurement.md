# Chrome, surfaces, and bar measurement

ScreenMotion wires status/system bars, shared top/bottom bars, the decorator, and the surface registry (`registerScreenSurface`). Surface opacity is computed from styles and re-measured on each status flip.

Shared-bar spacing has a pre-paint ordering contract:

1. The ref callback measures first, writing both the spacer and a measurement ref.
2. The registration layout effect publishes identity and height in one store notification.
3. `observeBarHeight` makes an idempotent initial report and tracks dynamic resizes.

A matching partner's registered height seeds the destination spacer during render, before its own bar measures. Re-registering the same ID preserves cached height; changing ID discards it.
