# Layer coordinates

`StagingRect` contains `x`, `y`, `width`, and `height`. `intoLayerSpace` reads the layer's bounding rectangle and compares painted dimensions with `offsetWidth` and `offsetHeight` independently per axis.

Scale is 1 when the laid-out dimension is nonpositive or the painted-versus-laid-out difference is at most 0.5 pixels. The tolerance avoids false scale correction from integer-rounded layout measurements but deliberately ignores sufficiently small real scale differences. Otherwise, scale is painted size divided by laid-out size, falling back to 1 for a falsy ratio.

Position is translated by the layer's left/top and divided by the corresponding scale; dimensions are divided by that scale. This converts axis-wise scale and translation, not general transforms.

Source comments report fractional-layout landing errors on an iPhone; no new device verification accompanies this document.
