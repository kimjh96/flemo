---
"@flemo/devtools": minor
---

Add `attachSwipeProbe`, which reports what a swipe release did to the screens.

A drag is not a flight. The navigate status stays COMPLETED for its whole
length, so the recorder never opens a window for one and every other probe in
this package looks straight past the moment that decides how a swipe feels: the
frame the finger comes off.

That gap cost a day. A cancelled swipe was reported as returning with no
transition at all, and every instrument here called the flight clean, because a
cancel is not a flight. The release clock was right the whole time; what was
wrong was the shape, a return that crossed its last hundred pixels at a dead
constant speed and stopped. A duration is not evidence that anything eased.

So the probe reads the screens frame by frame from the release onward and says
whether the landing decelerated, how far the largest single frame carried it,
and what was driving the screens on each of those frames, including nothing.
It reads the release off whichever screen travels furthest, so a parallax
partner moving a third as far cannot flatten the reading.

Production keeps the noop, as with every other attach in this package.
