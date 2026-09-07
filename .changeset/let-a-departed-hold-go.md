---
"@flemo/core": patch
---

Let a shared element fly on a pop under a transition with no clock of its own.
The morph layer mirrors the strongest hold among the screens the flight belongs
to, and a screen that unmounts while held could never release it: an attribute
observer on a removed node never fires again, so the flight sat at time zero for
its whole length and then cut the element home. A source that has left the
document is now read as released, and its removal is watched where it sat.
