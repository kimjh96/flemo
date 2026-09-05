---
"@flemo/devtools": minor
---

Rebuild the recorder as one probe module per question and add the four
instruments this project kept building by hand and deleting.

`attachDevtoolsHud` is an on-device readout: one monospaced line a phone can be
photographed showing, a tap for the detail block, a long press to cycle the
comparison bucket. It repaints only between flights and its stylesheet carries
no animation, so it cannot become the artifact it measures.

Reports now lead with `verdict` and `preconditions`. A number is only evidence
if the session that produced it was allowed to produce one, so the observable
half of the judging protocol is checked and stated first: device emulation, the
idle display cadence (a half-rate clock is named as the Low Power Mode ceiling
rather than as a defect), whether the page stayed in the foreground, long tasks
that ran while nothing was navigating, development-server globals, and whether
real or touch input drove the session. The traps a page cannot see stay
`unknown` rather than being guessed at.

Flights gain a `morphs` section that groups shared elements by their pairing key
and names the pairs that never flew, a `tripwires` list of one-frame events the
browser reported (a cancelled animation, an `animationend` with no elapsed time,
a ghost cut inside a frame, a hold re-asserted after its release), an `input`
record of what drove the navigation, and `motion.firstAnimationAtMs`. `mark()`
labels flights into comparison buckets and `comparison` does the A/B arithmetic;
the last flights survive a full page load in `previousSession`.

Report schema is now `"3"`. The retired player's gap mirror is gone with its
`playerGaps` field and `computePlayerGapStats`, and the driver tier it named is
now `inline`: flemo compiles every animation, so that signature means something
else is writing frames onto a participant.
