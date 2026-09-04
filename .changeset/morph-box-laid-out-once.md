---
"@flemo/core": patch
---

Lay a morph's box out once where its own contents were measured not to move, and cut the growth back with a clip instead, so a subtree that has nowhere to go is no longer re-laid-out and re-rastered on every frame of a flight. Hold the far edge on the engine's layout unit so it can no longer oscillate by a 64th of a pixel between frames.
