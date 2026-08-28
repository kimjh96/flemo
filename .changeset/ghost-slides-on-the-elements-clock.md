---
"@flemo/core": patch
---

Slide the ghost by left/top instead of a transform so its position resolves on the same main-thread ticks as the element's box animation; wholly transform-carried, WebKit ran the copy on the compositor's clock and the pair visibly trembled against each other.
