---
"@flemo/core": patch
---

Morph type now re-typesets instead of merely re-sizing: weight and letter-spacing interpolate alongside font-size, so a 14px/600 list label growing into a 24px/800 heading passes through every face between rather than wearing the destination's from the first frame. And the departure's cut now lasts as long as the flight rather than as long as the travel — under a screen transition with no motion of its own, the element that had just flown away used to reappear at full size for the frames between the landing and the screen's own end. A cut is also superseded when a new flight picks up either of its two elements, so a pop that interrupts a push cannot bring the previous flight's hidden state home with it.
