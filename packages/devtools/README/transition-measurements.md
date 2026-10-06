# What is measured

Each recorded transition (`TransitionRecord` in `report().transitions`) carries the measurements below.

## Motion

`motion` checks whether animated values advance independently of frame arrival. It records sampled and stalled frames, `longestStallMs` (reported as an anomaly from 48 ms), `pausedAfterRelease`, and `holdReassertedAtMs`. It reads the animation's current time or inline styles without forcing style recalculation. Still frames at the transition's end count as its tail, not a stall.

## Shared elements

A `Morph` with no partner raises no error, sets no attribute, and runs no animation. To expose missing pairs, the runtime writes the pairing key on every registered `Morph` as `data-flemo-morph-id`. `morphs` groups the two ends:

- `pairable`: both ends had everything needed to pair.
- `moved`: both ends received a role in the transition.
- `skipped`: pairable ends that received no role.

It also reports duplicate keys within one screen (a consuming-app mistake rather than a flemo mistake) and leftovers after the transition: roles, placeholders, ghosts (fading copies of old elements), elements in the transition layer, and keyframe rules never removed.

## Tripwires

`tripwires` are browser-reported events, not recorder samples: a cancelled flemo animation, an `animationend` with `elapsedTime` 0, a hold reapplied after release, and a ghost removed within one frame. Sampling cannot see a defect lasting one frame; a listener cannot miss it.

## Input

`input` records trusted and synthetic pointer events around a transition and their pointer types. Script-only sessions never trigger gesture code; mouse-only sessions never exercise the touch path.

## Images, long tasks, and the end of a transition

`images` records images loading at the start, images added, completed, and held, and `completedUnheld`. Images are counted separately: a held image still loading cannot cancel out an unheld image that completed.

`longTasks` covers visible motion; `holdLongTasks` covers work absorbed while the transition was held.

Two animation frames after `COMPLETED`, the recorder checks for leftover inline transforms, screens resting outside the viewport, statuses stuck for more than 10 seconds, and hold markers nobody will remove. Results appear in `endAudit`. The hold-marker check is skipped while another transition is running.
