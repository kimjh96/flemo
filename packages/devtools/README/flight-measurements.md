# Flight measurements

## Motion

`motion` measures pose advancement independently of frame arrival. It records sampled and stalled frames, `longestStallMs` (anomaly threshold: 48 ms), `pausedAfterRelease`, and `holdReassertedAtMs`. It uses animation clocks or inline poses without a style flush. Stationary closing frames are tails, not mid-flight stalls.

## Shared elements

An unpaired morph produces no error, attribute, or animation. The runtime therefore writes the pairing key onto every registered morph as `data-flemo-morph-id`; `morphs` groups the ends:

- `pairable`: ends had everything needed to pair.
- `flew`: ends were stamped with a flight role.
- `skipped`: the difference.

It also reports duplicate keys within one screen, a consumer mistake rather than a runtime mistake, and landing residue: roles, stand-ins, ghosts, elements stranded in a flight layer, and keyframe rules never dropped.

## Tripwires

`tripwires` are browser-reported events rather than recorder samples: a cancelled flemo animation, an `animationend` with `elapsedTime` 0, a hold re-asserted after release, and a ghost cut inside a frame. Sampling cannot see a defect lasting one frame; a listener cannot miss it.

## Input

`input` records trusted and synthetic pointer events around a flight and their pointer types. Script-only sessions never fire gesture machinery; mouse-only sessions never exercise the touch path.

## Images, long tasks, and landing

`images` records loading at start, additions, completions, held images, and `completedUnheld`. Count per image so a held loading image cannot cancel an unheld completion.

`longTasks` covers visible motion; `holdLongTasks` covers absorbed work.

Landing is audited two rAFs after `COMPLETED` for residual inline transforms, off-viewport rest, statuses stuck over 10 seconds, and orphaned holds. Skip orphan auditing while another flight is running.
