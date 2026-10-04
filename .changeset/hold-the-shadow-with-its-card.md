---
"@flemo/core": patch
---

Hold a revealed morph's shadow carrier on the same clock as the morph it travels under. The carrier is neither the morph nor a Part nor the ghost, so the compiled hold rule never reached it and it started at the style commit while the rest of the transition waited for the release, running the whole travel ahead of the card by the length of the hold.
