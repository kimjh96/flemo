---
"@flemo/core": patch
---

Present a container transform's camera on the same thread as the element it carries. A `carry: "screen"` zoom ran its screen from the compositor while the card travelled by its box on the main thread, so the two drifted apart by however far behind that thread was and the card trailed the grid it was opening out of.
