---
"@flemo/core": patch
---

Rework the `layout` transition so one screen moves at a time. It ran `0.97 → 1`, which is not a fade at all: the arriving screen popped in whole and the dismissing one hard-cut — survivable only while its partner was a fully transparent screen, where the screens were never visible in the first place. A true cross-fade was worse, because two opaque screens at half opacity double-expose. Now a push fades the arrival in over a stationary screen and a pop fades the dismissal out over one, with a front-loaded curve that is done in the first third, and 0.4s in total so the shared element above has enough of the flight to read as travel.
