---
"@flemo/core": patch
---

Swipe back on a screen that hosts a nested `<Router>` and the screen's own dim now moves with the drag. The gesture resolved the previous screen's decorator, shared bars and parts with a descendant query, which finds the INNER router's elements first — so the inner dim faded while the screen's own stayed fully dark for the whole drag.
