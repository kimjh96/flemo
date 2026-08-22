---
"@flemo/core": patch
---

Fix a cancelled swipe snapping back. The release clock sized every settle from the finger's momentum and the distance left, but a cancel travels _against_ the finger and only ever from below the transition's commit threshold — so both terms collapsed and every cancel ran the 0.12s floor, snapping an authored curve. A settle that reverses the gesture now ignores momentum it cannot borrow and lands no faster than 0.28s, still capped by the transition's own duration.
