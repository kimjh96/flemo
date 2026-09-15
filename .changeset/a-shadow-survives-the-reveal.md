---
"@flemo/core": patch
---

Clip a Morph's box instead of resizing it only when every computed property of the arrival and every carried paint channel of the departure is proven to draw the same picture. A shadow, border, outline, image, mask, filter, transform, percentage corner, ellipsis, scrollbar, pseudo-element, unclipped overflow, or any property the engine does not know now lays the box out for real, and a clipped reveal's corner travels with the box's own radius.
