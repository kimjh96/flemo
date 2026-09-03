---
"@flemo/core": patch
---

Bound a parked screen's opacity by the composite rather than by eye. A park is drawn over its cover, so the most it can move a pixel is its opacity times the two colours' distance, and an eight-bit composite steps at 1/255 — under that it cannot move one whatever it is drawn over. At 0.02 it was five steps, and a tab switch parks a whole screen for the length of the hold: reported on iOS Safari as the next tab showing through before its transition.
