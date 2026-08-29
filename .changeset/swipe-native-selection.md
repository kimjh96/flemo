---
"@flemo/core": patch
---

Stop a mouse drag from losing the swipe to the browser's own gestures. Dragging across a screen's text started a native selection, which took the pointer away with `pointercancel` and force-cancelled the gesture; selection and image-drag are now suppressed for exactly as long as a gesture holds the pointer.
