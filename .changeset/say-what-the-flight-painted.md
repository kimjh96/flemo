---
"@flemo/core": minor
"@flemo/devtools": minor
"@flemo/react": minor
---

Report three authoring mistakes that used to be silent. A morph whose `exit`
pose does not end at `opacity: 0` leaves the element it is flying away from on
glass for the whole flight, because that pose is the cut the runtime pins the
departure at; a camera paired with a screen transition that also moves the
screen has its travel discarded rather than combined; and a Router with layout
children but no `<Slot>` cannot tell screens from chrome. Each now says so once
in development.

The flight recorder gains the two measurements behind the first of those: how
many frames a departing end kept painting, and how far a `<Part>` inside a
flying box sat inside that box. Both are defects it watched happen in silence,
and both surface as anomalies on the flight record.
