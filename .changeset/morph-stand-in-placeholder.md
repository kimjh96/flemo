---
"@flemo/core": patch
---

Hold a flying element's place with a copy of it rather than with a box the size of it. The placeholder was an empty block given the element's measured width, height and margins — right to the pixel, and still wrong: WebKit-measured, a card inside an `inline-block` button left its `<li>` 6.31px taller for the entire flight, because an empty block gives the button no baseline to synthesise from and the line box then adds the strut's descender. Everything below the element sat 7px low until the landing snapped it back, which is a layout shift with a morph's exact timing. Chromium adds that space at rest too, so it never moved there and the bug was invisible on it. A stand-in copy has the same box, the same margins and the same baseline, so the layout cannot tell it apart — and the three inline overrides that used to approximate them are gone.
