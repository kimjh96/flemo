---
"@flemo/web": patch
---

Tighten the gap between the playground card's title and its date line, in the cell and on the detail. The 12px gap was there to keep the two ends' geometry sums equal for the morph; since the core now carries a nested flight from its measured from-pose, the spacing is free to be design again. The bottom padding moves off the fixed-height meta holder onto the card itself, since border-box sizing was swallowing it and leaving the date line two pixels off the card's bottom edge.
