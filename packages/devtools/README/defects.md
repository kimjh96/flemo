# Detected defects

Each defect is reported as a stable message, quoted below as it appears in a report, followed by what it means.

- `hold re-asserted …ms into the transition`: flemo pauses a transition briefly before it starts (a hold). The hold was applied again after the transition had already started moving.
- `motion stalled …ms mid-transition`: the animated values stopped advancing, or stopped and then jumped, while frames kept arriving.
- `playState=paused`: the animation itself was paused after it started, so the motion stopped for a reason other than missed frames.
- `image(s) finished loading mid-transition without a hold`: an image finished decoding on the moving layer during a transition.
- `hold markers left on the page at rest`: content was hidden for a hold and nothing is left to show it again.
- `screen resting at its starting style while COMPLETED+active`: the transition ended with the active screen still at its starting position, leaving a blank viewport.
- `long task …ms overlapped the visible-motion start`: a long task swallowed the start of the motion.
- `transitional status stuck >10s`: a screen stayed in a transitional status, so the navigation queue remains locked.
- `shared element(s) did not move`: both ends of a `Morph` were registered on two screens, but the shared element never animated between them.
- `morph element(s) still carry a transition role at rest`: a `Morph` element kept its transition role after the transition ended, which breaks the next pairing.
- `tripwire zero-length-animation-end`: something reacted to the end of an animation that never ran.
- `a morph's old-screen end stayed visible for … frames`: the `exit` variant of a `Morph` on the previous screen does not end at `opacity: 0`, so it stays visible behind the transition. A pop shows it as the transition ends.

All of these have occurred while frame timing looked clean.

A leftover `flemo:*` storage key from a removed feature, such as `flemo:motion-driver-force`, is reported in `overrides.warnings` as `RETIRED residue`. flemo no longer reads these keys, so they cannot cause what you see.
