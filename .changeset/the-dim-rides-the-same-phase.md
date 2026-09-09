---
"@flemo/core": minor
---

Put the dim on the same phase as everything else riding a drag. `overlay` drove
its own gesture with `1 - progress / 100`, which is linear in the screen's
position while the flight runs the dim on the clock it inherits: measured on a
cupertino pop with the screen three quarters across, the flight had the dim at
0.62 and the drag at 0.245. Declaring any swipe hook opts a decorator out of the
declarative rider, so the hooks were what kept it out of the path that reads the
gesture through the screen's own curve. They are gone, and the same measurement
now matches the flight to three decimal places. A decorator's own curve is still
never inherited from the screen; that is a separate rule and it is unchanged.
