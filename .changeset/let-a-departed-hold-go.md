---
"@flemo/core": patch
---

Let what a flight holds go when the screen that held it leaves. Three surfaces
had the same defect: the morph layer and the bar-part layer both mirror the
screens' hold onto themselves, and a screen that unmounts while held could never
release it, so the shared element and the lifted parts sat at time zero for the
whole flight and were then cut into place; and the hold a flying screen stamps
onto a `<Part>` outside the screens stayed on that persistent chrome for the rest
of the session. A hold source that has left the document now reads as released,
its removal is watched where it sat, and a screen's own teardown takes its stamp
with it.
