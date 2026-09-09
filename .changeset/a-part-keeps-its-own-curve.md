---
"@flemo/core": patch
---

Stop a `<Part>` inheriting its screen's easing. The inheritance was added on the
reasoning that a part's pose is a place on the screen and so has to share the
screen's curve, and that reasoning does not hold: a part is inside its screen
and rides that screen's transform already, so there is no gap with the screen
for a shared curve to close. The participant that does need it is a morph, and
only because it leaves the screen for the flight layer. A part keeps the curve
it authored, and CSS `ease` when it authors none, which is what it did before.
