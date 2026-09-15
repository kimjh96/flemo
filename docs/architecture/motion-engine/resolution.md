# Single-resolution contract

Exactly one live path resolves a flight's `TaskManager` navigation task. `resolveTask` ignores noncurrent IDs. Every resolver captures `flooredTaskId` when armed so stale work cannot resolve a newer flight.

1. `animationend` is wired from the first transitional render and accepts the `-lpm` name. It cannot fire while hold pauses animation.
2. The compiled perceptual cut detaches `animationend` before calling `resolvePresented`.
3. WebKit `animationcancel` recovery uses `wireCancelResume` to rejoin the original timeline up to `RESUME_BUDGET = 4` times per task ID, not per effect. If no signal arrives, the watchdog replays once from `from` and resolves. Recovery disarms wall-clock cut and early landing because presentation has shifted.
4. The liveness floor resolves the captured task ID after `max(motionSpan, participantSpan) + 1500ms`, preventing a rapid storm that orphans an element from deadlocking the serial queue.
5. `TaskManager.anchorGate` and `markGateHeld` are the final backstop. They rearm while hold remains active so a long entering commit cannot cause a transition-less cut, and use the choreography span so long authored motion is not truncated.

Resolution targets the live queue. Duplicate resolution can finish its deferred two-rAF landing-clear and choreography chain after the next task starts, cutting that newer navigation. Campaign R19-v3 exposed this as a fast-back pop reaching COMPLETED at about 90 ms with no motion. Any new completion path must capture and resolve its own task ID or be provably suppressed while another path is live.
