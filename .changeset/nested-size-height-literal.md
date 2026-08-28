---
"@flemo/core": patch
---

Emit a nested morph's width and height as separate keyframe declarations. The size channel's two declarations were joined with an escaped newline that reached the stylesheet as a literal backslash-n, which silently voided the height: the width animated alone, so a pop shrank the artwork as a squashed rectangle from a shrunken start and its corner reads followed the deformation. The rule's tests now also reject any literal backslash, since substring assertions passed right over the malformed line.
