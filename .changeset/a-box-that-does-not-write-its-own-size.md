---
"@flemo/core": patch
---

Let a morph's box grow on WebKit. An element that animates a custom property has its animated `width` dropped there: the size holds its first keyframe for the whole flight and jumps to its last on the landing frame, while the position it is driven by runs correctly. Reported from a consumer's tab switch as a pill whose contents were clipped for the whole flight and snapped open at the end. The box's size now travels the way its position already does, through registered lengths the element reads, so the engine has nothing but custom properties to interpolate. Measured on the same switch, the width went from one value across the flight to tracking its position frame for frame.
