---
"@flemo/core": patch
---

Make a swipe release leave at the speed the screen already had. The settle ran the transition's authored curve, which is front-loaded because it starts from rest — so a committing swipe departed at 1.7x the finger's speed on a hard flick and 8.4x on a gentle drag, and a cancel departed at 2.25x from a screen the finger had brought to a stop. The release now re-aims that curve's opening onto the gesture and derives its length from a decelerating landing, in both directions.
