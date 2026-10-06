# Detected defects

Each stable report message below is followed by its meaning.

- `hold re-asserted …ms into the transition`: flemo briefly pauses a transition before it starts (a hold); the hold was applied again after motion began.
- `motion stalled …ms mid-transition`: animated values stopped advancing, or stopped and then jumped, while frames kept arriving.
- `playState=paused`: the animation was paused after it started, stopping motion for a reason other than missed frames.
- `image(s) finished loading mid-transition without a hold`: an image finished decoding on the moving layer during a transition.
- `hold markers left on the page at rest`: content was hidden for a hold, with nothing left to show it again.
- `screen resting at its starting style while COMPLETED+active`: the transition ended with the active screen at its starting position, leaving a blank viewport.
- `long task …ms overlapped the visible-motion start`: a long task swallowed the start of motion.
- `transitional status stuck >10s`: a screen stayed in a transitional status, leaving the navigation queue locked.
- `shared element(s) did not move`: both ends of a `Morph` were registered on two screens, but the shared element never animated between them.
- `morph element(s) still carry a transition role at rest`: a `Morph` element retained its transition role after the transition ended, breaking the next pairing.
- `tripwire zero-length-animation-end`: something reacted to the end of an animation that never ran.
- `a morph's old-screen end stayed visible for … frames`: the previous screen's `Morph` `exit` variant does not end at `opacity: 0`, so it remains visible behind the transition. A pop shows it as the transition ends.

All these defects have occurred while frame timing looked clean.

A leftover `flemo:*` storage key from a removed feature, such as `flemo:motion-driver-force`, is reported in `overrides.warnings` as `RETIRED residue`. flemo no longer reads these keys, so they cannot cause the observed behavior.
