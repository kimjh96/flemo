---
"@flemo/core": patch
---

Let a morph's box grow on WebKit. The travelling element was given an inline `width` and `height` that the travel keyframe also animates, and WebKit resolved that pair in favour of the inline declaration: the element crossed the full distance at its departure size and snapped to its destination size in one frame at the landing. The keyframe already states the box for every frame of the flight, so it is now the only thing that does.
