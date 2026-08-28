---
"@flemo/core": patch
---

Return the camera to its transform: the zoom-property carriage mis-anchored the pan (offsets on a zoomed element resolve in the zoomed coordinate space) and bought no smoothness — with the ghost removed and every remaining animation on the main clock, WebKit still renders a layout-driven flight unevenly.
