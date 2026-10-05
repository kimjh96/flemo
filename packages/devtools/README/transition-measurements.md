# What is measured

Each recorded transition, a `TransitionRecord` in `report().transitions`, carries the measurements below.

## Motion

`motion` checks whether the animated values actually advance, separately from whether frames arrive. It records sampled and stalled frames, `longestStallMs` (reported as an anomaly from 48 ms), `pausedAfterRelease` and `holdReassertedAtMs`. It reads the animation's current time or the inline styles, without forcing a style recalculation. Still frames at the very end of a transition count as its tail, not as a stall.

## Shared elements

A `Morph` that finds no partner raises no error, sets no attribute and runs no animation. To make that visible, the runtime writes the pairing key onto every registered `Morph` as `data-flemo-morph-id`, and `morphs` groups the two ends:

- `pairable`: both ends had everything needed to pair.
- `moved`: both ends were given a role in the transition.
- `skipped`: pairable ends that were not given one.

It also reports duplicate keys within one screen, which is a mistake in the consuming app rather than in flemo, and anything left behind after the transition ends: roles, placeholders, ghosts (the fading copy of the old element), elements left in the transition layer, and keyframe rules that were never removed.

## Tripwires

`tripwires` are events the browser reports itself, not recorder samples: a cancelled flemo animation, an `animationend` with `elapsedTime` 0, a hold applied again after release, and a ghost removed within a single frame. Sampling cannot see a defect that lasts one frame; a listener cannot miss it.

## Input

`input` records trusted and synthetic pointer events around a transition, and their pointer types. A session driven only by script never triggers the gesture code, and a mouse-only session never exercises the touch path.

## Images, long tasks, and the end of a transition

`images` records images loading at the start, images added, completed and held, and `completedUnheld`. Each image is counted separately, so a held image that is still loading cannot cancel out an unheld one that completed.

`longTasks` covers the visible motion; `holdLongTasks` covers work absorbed while the transition was held.

Two animation frames after `COMPLETED`, the recorder checks for leftover inline transforms, screens resting outside the viewport, statuses stuck for more than 10 seconds, and hold markers nobody will remove. The results are in `endAudit`. The last check is skipped while another transition is running.
