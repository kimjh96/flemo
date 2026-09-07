---
"@flemo/core": patch
---

Let what a staging layer carries fly when the screen it belongs to leaves. Both
layers the engine lifts into mirror the screens' hold onto themselves, and a
screen that unmounts while held could never release it: an attribute observer on
a removed node never fires again, so the shared element and the bar's parts sat
at time zero for the whole flight and were then cut into place. A source that has
left the document is now read as released, its removal is watched where it sat,
and both layers share one copy of that rule.
