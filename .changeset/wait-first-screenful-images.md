---
"@flemo/core": patch
---

Count the entering screen's first-screenful image loads as in-flight work in the content-settle gate: an incomplete eager image now holds the motion (under the same settle cap) the way a pending fetch does, so image paints land before the flight instead of stealing a frame during it. Below-the-fold and not-yet-started lazy images are skipped.
