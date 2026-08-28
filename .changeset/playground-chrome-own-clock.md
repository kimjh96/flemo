---
"@flemo/web": patch
---

Give the playground card's chrome its own clock so the card grows naturally. The back control and the buy control are a fixed size whatever the card is: at the start of a push the card is a grid cell about 155px wide and the header's scrim alone is 90px, so the chrome covered more than half of it and then dwindled to a thin strip as the card reached full size. The card grew, the chrome did not, and the proportion inverted on the way. Chrome now arrives once the card has most of its size and leaves only once it has lost most of it, so the box travels carrying nothing but the artwork.
