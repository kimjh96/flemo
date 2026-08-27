---
"@flemo/web": patch
---

Stop the playground's container transform starting smaller than the cell it left. A grid cell's `<button>` is `inline-block` by default, so its line box added the strut's descender under the card inside it and the card's own box measured 207px inside a 214px cell; a flight that starts from the card's box therefore started 7px shorter than the cell, which reads as the card shrinking before it grows. The button is a block now, and the flight's first frame matches the cell exactly. The caption returning to a cell also waits until the card has landed rather than fading in under an artwork that is still moving.
