---
"@flemo/core": patch
---

Ride the camera on the CSS zoom property with a relative-offset pan instead of a transform, so a container transform's background resolves on the same main-thread ticks as the card it frames; a transform camera ran on the compositor's clock and WebKit rendered the pair trembling against each other.
