---
"@flemo/web": patch
---

Give the hero's demo cards their separated pose in the markup itself. The two
cards run one keyframe loop offset by half a cycle, but the offset was applied
only by a client layout effect, so the served HTML gave both the same animation
with the same absent delay: both sat at the keyframe's 0% pose, identical
transform and identical z-index, stacked exactly on top of each other with the
music card, later in DOM order, covering the wallet outright. The browser
painted that and hydration threw the music card back in one frame, which read as
the demo flickering and resetting on every refresh.

Measured on the page, sampling every frame from before hydration: 12 of 287
frames had the two cards sharing a pose, about 200ms of the wrong app in the
hero. It is 0 of 258 now, and an end-to-end test samples the same way so the
next regression is caught in the frames that are actually painted.

The shared roll clock also starts on the first mount rather than at script
evaluation, so the layout effect's re-anchor agrees with the pose the markup
painted instead of moving it by however long the bundle took to run.
