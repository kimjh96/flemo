---
"@flemo/core": patch
---

Draw a revealed morph's carried gradient and shadow the way the box draws them itself. The image is sized to the border box rather than the padding box, which was leaving the tile smaller than the box and showing the repeat as two hard seams, the two ends of the shadow are padded to the same number of layers so the filter can interpolate instead of swapping halfway, and a tightening spread comes out of the shadow's offset rather than its blur, which had been flattening a layer into a hard band.
