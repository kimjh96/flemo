---
"@flemo/core": patch
---

Fix a shared element sitting still through a back-swipe and then making the trip on its own after the screens have landed. The gesture staged its morph flights before the covered screen had re-registered its `<Morph>` children, so it found no arriving partner and carried nothing.
