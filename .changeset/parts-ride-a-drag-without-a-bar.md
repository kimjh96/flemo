---
"@flemo/core": patch
---

Drive a screen's own `<Part>` elements during a swipe drag even when that screen
has no shared bar. Arming sat behind the covered side's bar-part staging, which
declines when there is nothing to lift, so a part that is the screen's own
chrome held its pose for the whole drag and then jumped at the release. The two
readiness conditions are separate now, the way the decorator's already were.
