---
"@flemo/core": minor
---

Add `carry: "screen"` to `createMorphTransition`, and a `zoom` preset that uses it — the container transform. A plain morph moves one element and leaves the screens to their own transition; `carry` also zooms the screen the element is small on by exactly the amount that takes the element from one end of the flight to the other, so a grid opening into a full-screen view reads as the camera pushing in on the tapped card rather than as the card escaping a grid that stayed behind. It works in both directions from one rule — the camera always rides the screen holding the smaller box, which is the departing screen on a push and the arriving one on a pop. It supersedes that screen's own transform for the flight, so pair it with a transition that leaves the screen still.
