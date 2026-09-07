---
"@flemo/web": patch
---

Give the playground's `tether` case the detail header it was asking for. The
chrome part is picked by the bench's transition name, and the clock table had no
row for `tether`, so the header resolved to a part transition that was never
created: it appeared whole the instant the screen arrived instead of being held
through the flight and lowered into place.
