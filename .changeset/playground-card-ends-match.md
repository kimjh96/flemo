---
"@flemo/web": patch
---

Give the playground's container transform the same arrangement at both ends. The grid cell inset its artwork by 8px and the detail inset its own by 20px, so the first frame of a flight swapped one inset and corner radius for the other while both were drawn at the same size. Both now carry the artwork full-bleed across the top of the card with the type inset below it.
