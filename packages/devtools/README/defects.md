# Detected defects

Stable anomaly signatures include:

- `hold re-asserted …ms into the flight`: a stale paused hold was rewritten during motion.
- `motion stalled …ms mid-flight`: motion froze, or froze then leapt, despite continuing rAF.
- `playState=paused`: posed motion stopped rather than suffering frame starvation.
- `image(s) finished loading mid-flight without a hold`: decode rastered on the moving layer.
- `hold markers left on the page at rest`: hidden content has no owner to reveal it.
- `screen resting at from-pose while COMPLETED+active`: blank-viewport landing.
- `long task …ms overlapped the visible-motion start`: swallowed opening.
- `transitional status stuck >10s`: the navigation queue remains locked.
- `shared element(s) did not fly`: both ends were registered on two screens and neither took a flight role.
- `morph element(s) still carry a flight role at rest`: a stranded participant poisons the next pairing.
- `tripwire zero-length-animation-end`: something landed on an animation that never ran.
- `active force pin flemo:motion-driver-force=…`: diagnostic residue pins a driver.

These defects have occurred with clean frame timing.
