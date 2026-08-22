---
"@flemo/core": patch
---

Make a swipe release leave at the speed the finger had. The settle ran the transition's authored curve, which is front-loaded because it starts from rest — so the screen departed at 1.7x the finger's speed on a hard flick and 8.4x on a gentle drag, reading as a whip rather than a continuation. The release now re-aims that curve's opening onto the gesture and derives its length from a decelerating landing; the cancel keeps the curve and clock it already had.
