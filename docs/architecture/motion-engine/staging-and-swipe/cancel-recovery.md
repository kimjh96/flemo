# Compiled-animation cancellation

`cancelResume.ts` in `packages/core/src/core/engine/` provides `wireCancelResume`. Task-resolution ownership remains the caller's responsibility.

## Cancellation filtering and termination

`wireCancelResume` listens for cancellation of the configured element and matching transition animation name. It ignores:

- Other targets and names.
- Synchronous events during its own restart.
- Announced expected cancellations.
- Cancellations with a live matching successor that is neither idle nor finished.

The successor check prevents keyframe swaps or asynchronously delivered restart cancellations from repeatedly consuming the recovery budget.

`RESUME_BUDGET` is four; callers supply budget accounting and liveness. A dead participant or exhausted budget invokes `onTerminal`. A positive-duration animation also terminates when its active elapsed time has reached its duration.

## Resume position and delay

The resume position comes from `animationcancel.elapsedTime`, clamped to nonnegative milliseconds. This is active-phase time, excluding authored delay. Recovery drops the animation, forces reflow, and restores the compiled rule:

- At zero active elapsed time, restart without changing the inline delay. The authored delay replays in full because the event provides no position within its delay phase.
- After active motion begins, lease `animation-delay` under the configured writer and set it to the negative active elapsed time. Do not add the authored delay again.
- A zero-duration variant bypasses the positive-duration end test so delay-only authoring can replay.

Detaching restores a rejoin delay written by this controller through the inline lease, preventing interruption from carrying that offset into a later transition. The watchdog's `fullRestart` explicitly removes the inline delay and restarts from the compiled beginning.
