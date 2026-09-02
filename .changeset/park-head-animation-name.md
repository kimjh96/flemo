---
"@flemo/core": patch
---

Recognize the parked heads' `animationend`. Their keyframe names were never added to the suffix list, so a parked flight never resolved on its own animation and the restart watchdog replayed the whole transition.
