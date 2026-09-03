---
"@flemo/core": patch
---

Carry a type morph's ascent cancellation on the same channel its position travels on, so it applies to every pair rather than the ones that happened to have a spare property. A pair riding its container writes its own transform and had nowhere to put the cancellation, which left the baseline stepping on exactly the flights a container transform is made of.
