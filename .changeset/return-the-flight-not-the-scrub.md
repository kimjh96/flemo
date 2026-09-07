---
"@flemo/core": patch
---

Bring a cancelled swipe's shared element home on the transition's own curve. The
morph's release replayed the drag backwards, which walks the curve's opening and
lands at a constant speed, so a cancelled morph slid home flat while the screens
around it decelerated. It now runs a return leg staged with the drag: the
declared path walked the other way, stops and all, seeked to the pose the finger
left and played forward.
