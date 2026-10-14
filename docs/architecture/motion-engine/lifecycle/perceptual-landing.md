# Perceptual cut and early landing

`perceptualSpan.ts` permits resolution only after every animated channel of every participant, including active and passive screens, parts, and a present decorator, has permanently entered its imperceptibility band: less than one device pixel or one alpha step remains. Any unanalyzable participating motion vetoes the cut. An absent decorator contributes no cut requirement.

## Current completion cut

The compiled path considers the cut after release, with a captured task ID, only when `!governedSlide && !routedForceCompiled`. Governed touch-WebKit PUSHING and POPPING are excluded by these routing predicates. This is not a blanket exclusion of touch-governed transitions: under the supplied routing table, REPLACING has neither predicate and may arm the cut if its remaining prerequisites pass.

The engine takes the maximum cut across the active screen, passive screen, Parts, and present decorator. It arms only when all required cuts are analyzable and `cutMs + 17 < motionSpanMs + choreographyExtraMs`. The timer delay is `cutMs + 17 + governedBirthHoldMs`. Its callback checks that the scope and captured task remain live, detaches the animation-end listener and recovery, and calls `resolvePresented` so the completion flip still waits for presentation frames.

Active-scope cancel-resume, watchdog restart, and clock-shift callbacks disarm the wall-clock cut because presentation may have shifted. These recovery paths do not operate an early arrival-landing timer.

## Current arrival landing

Arrival landing is separate from the perceptual completion cut. The supplied engine no longer schedules an early arrival release beneath the animation tail. Landing is uniformly deferred until after COMPLETED; `scheduleLanding` runs the callback after two rAFs, or immediately when rAF is unavailable. A pending landing can be flushed by `landNow()` before another navigation. See [completion](completion.md) for hold release and cleanup, and [binding lifecycle and DOM protocol](../binding-lifecycle-and-dom-protocol.md) for teardown behavior.

## Historical early-landing description

The following paragraph preserves the former placement rationale. It does not describe the current implementation:

Early landing releases the arrival hold when every participant is within one CSS pixel or alpha step, using a DPR-1 band at or before the cut. This places reveal layout and paint beneath the subpixel tail. Early landing follows the cut's disarm rules.
