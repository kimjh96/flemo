---
"@flemo/core": patch
---

Read a swipe's travel off the screen it is dragging instead of off the raw
pointer offset. Every handler clamps its screen at rest, so a finger that came
back past where the drag began left the screen still while the absolute offset
kept growing: the dim went on lifting off a screen that was not moving
(measured at opacity 0.28 with the screen at translateX(0)), and a release
there told the settle most of the trip was already done, so a commit crossed
the whole screen in the time left for its last few pixels. The gesture's travel
is now the signed offset along the swipe axis clamped to that screen, which
also stops a drag past the end from growing the remaining distance again.

Two more release-clock corrections ship with it. The finger is now measured at
the moment it lets go rather than at its last move, so a gesture carried across
and then held still no longer lands at the speed it had before it stopped. And
a landing may no longer outrun the authored motion by more than three times its
own average speed, which is what turned a fast flick into a cut: the previous
floor was a flat 0.12s, generous for the last twenty pixels and a teleport for
a whole screen.
