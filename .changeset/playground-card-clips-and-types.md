---
"@flemo/web": patch
---

Stop the playground's container transform painting a page over the grid it is growing out of. flemo animates a morph's layout box and lets the subtree lay itself out at each size, so the detail's own type was at page size from the first frame inside a box still the size of a cell, spilling across the poster grid and doubling every line against the ghost. The card clips its contents while it grows, the act's name pairs as a `text` morph so it re-typesets from label to heading instead of being drawn twice, and the card is now the whole screen rather than its scrolling body, so the header and the buy control grow with it instead of standing at full width around a cell-sized card.
