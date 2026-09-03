---
"@flemo/core": patch
---

Move a flight's position from `left` and `top` onto `translate`, keeping the size on layout. Blink paints text at a layout position on whole CSS pixels, so a line of type travelling by its box stepped a full pixel at a time while every layout measurement of it reported a smooth curve. The size still animates, so the words still re-typeset on the way.
