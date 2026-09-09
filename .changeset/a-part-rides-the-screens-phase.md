---
"@flemo/core": minor
---

Give a `<Part>` the screen's easing when it names none, and drive every rider of
a drag on the phase of the screen it rides. A part that authored no curve ran
the CSS default while its screen ran the transition's, which put the two at the
same time and different places, and the drag made it worse: seeking a rider
through the inverse of its own curve cancels that curve, so a swipe sat every
part at the gesture's own fraction of its travel while the flight did not. The
same hand-over therefore read as two different motions depending on whether a
finger or a status started it. A decorator still keeps its own curve, because it
dims rather than taking a place on the screen and a positional curve
front-loads a luminance ramp into a step.
