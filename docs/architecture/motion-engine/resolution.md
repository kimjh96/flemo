# Single-resolution contract

Exactly one live path resolves a transition's `TaskManager` navigation task. `resolveTask` ignores noncurrent IDs. Every resolver captures `flooredTaskId` when armed so stale work cannot resolve a newer transition.

1. Wire `animationend` from the first transitional render and accept the `-lpm` name. It cannot fire while hold pauses animation. The supplied engine uses `matchesTransitionAnimationName` for head-tier names, requires the event target to be the scope, and ignores `elapsedTime === 0` when `activeMotion` exists. A zero-elapsed event in that case is not accepted as completion.
2. The compiled perceptual cut detaches `animationend` before calling `resolvePresented`. Its routing guard is `!governedSlide && !routedForceCompiled`, with release and captured-task prerequisites. Touch-governed REPLACING is not excluded solely for being touch-governed; see [perceptual cut and arrival landing](lifecycle/perceptual-landing.md).
3. WebKit `animationcancel` recovery uses `wireCancelResume` to rejoin the original timeline up to `RESUME_BUDGET = 4` times per task ID, not per effect. If no signal arrives, the watchdog replays once from `from` and resolves. Recovery disarms the wall-clock perceptual completion cut because presentation has shifted. Early arrival landing is historical; current arrival landing is scheduled after COMPLETED and is distinct from this cut.
4. The liveness floor resolves the captured task ID after `max(motionSpan, participantSpan) + 1500ms`. This prevents a rapid storm that orphans an element from deadlocking the serial queue.
5. `TaskManager.anchorGate` and `markGateHeld` are the final backstop. They rearm while hold remains active so a long entering commit cannot cause a transition-less cut. They use the choreography span to avoid truncating long authored motion.

Resolution targets the live queue. Duplicate resolution can finish its deferred two-rAF landing-clear and choreography chain after the next task starts, cutting that newer navigation. Campaign R19-v3 exposed this as a fast-back pop reaching COMPLETED at about 90 ms with no motion.

Any new completion path must capture and resolve its own task ID or be provably suppressed while another path is live.
