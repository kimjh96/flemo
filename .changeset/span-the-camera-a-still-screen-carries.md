---
"@flemo/core": patch
---

Complete a transition when the morph camera carrying a still screen actually lands, not ~200ms earlier. A `zoom` morph pairs with a screen whose own transition animates nothing, so the engine was resolving the task on that absent clock and flipping COMPLETED while the camera was still zooming, which showed as a stutter on the pop right before the screen settled. The task now spans the camera's animation, so the completion lands with it.
