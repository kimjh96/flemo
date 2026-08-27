---
"@flemo/web": patch
---

Line up the two ends of the playground's container transform. The detail card began with a 52px header and a grid cell's card begins with its artwork, so the two artworks sat 52px apart while the flight drew both at the same box: one gradient appeared to flicker, the page appeared to shift, and the header appeared to vanish, all from that single misalignment. The header moves out of the card's flow and floats over the artwork behind a scrim, so both cards start with the artwork at the same place.
