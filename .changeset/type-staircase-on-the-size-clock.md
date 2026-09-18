---
"@flemo/core": patch
---

Land a type morph's leading and lift staircases on the clock its font size runs on. The size reaches its destination a frame before the flight ends and holds it there, but the stops that cancel each grid step were placed against the full timeline, so every step fired after the boundary it was cancelling and the glyphs blipped once per stop.
