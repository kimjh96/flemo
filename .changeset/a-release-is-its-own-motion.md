---
"@flemo/core": patch
---

Give a released drag its own motion, so a cancel returns on the curve its
transition draws instead of arriving with no easing at all.

A drag and a release are different kinds of motion. The drag is position
controlled: the finger says where, and the scrub seeks the staged animation to
the time that pose sits at. A release is time controlled: a curve and a duration
say where. Sharing one animation between them made the release inherit the
drag's mapping, so which part of the authored curve it landed on was an accident
of where the finger stopped.

For a commit that accident was harmless, because playing on toward the end of a
curve ends where the author put the slow part. A cancel plays back toward the
beginning, and a cancel by definition stops short of the commit threshold, so it
always sits inside the curve's opening. Device-captured: a drag nine per cent of
the way across sat at 30ms of cupertino's 700, and the opening of any curve is
its own tangent, so the return crossed its last hundred pixels at a dead
constant speed and stopped. The deceleration the author drew was at the far end,
which a cancel never reaches.

Both motions a release can be are now staged with the drag and held out of
effect. The cancel's path is the declared one reversed, so playing it forward is
the author's own motion arriving at the pose the drag began from. The release
writes a time, a rate and a start, and never builds or reshapes an effect, which
is what keeps the compositor from having to commit an animation on the frame the
finger lifts.

Nothing here is written against a preset. Whatever a transition declares,
including its stops and whichever properties it moves, is what the release runs,
and both directions now run forward so a cancel fires an ordinary `finish`.
