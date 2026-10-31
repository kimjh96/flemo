# Perceptual cut and early landing

`perceptualSpan.ts` permits resolution only after every animated channel of every participant—active and passive screens, parts, and any present decorator—has permanently entered its imperceptibility band: less than one device pixel or one alpha step remains. Any unanalyzable participating motion vetoes the cut. An absent decorator adds no cut requirement.

## Current completion cut

After release, the compiled path considers the cut with a captured task ID only when `!governedSlide && !routedForceCompiled`. These predicates exclude governed touch-WebKit PUSHING and POPPING, but not all touch-governed transitions: under the supplied routing table, REPLACING has neither predicate and may arm the cut if its remaining prerequisites pass.

The engine takes the maximum cut across the active screen, passive screen, Parts, and present decorator. It arms only if all required cuts are analyzable and `cutMs + 17 < motionSpanMs + choreographyExtraMs`. The timer delay is `cutMs + 17 + governedBirthHoldMs`. Its callback checks that the scope and captured task remain live, detaches the animation-end listener and recovery, and calls `resolvePresented`; the completion flip still waits for presentation frames.

Active-scope cancel-resume, watchdog restart, and clock-shift callbacks disarm the wall-clock cut because presentation may have shifted. These recovery paths do not operate an early arrival-landing timer.

## Current arrival landing

Arrival landing is separate from the perceptual completion cut. The supplied engine does not schedule early arrival release beneath the animation tail. Landing is uniformly deferred until after COMPLETED: `scheduleLanding` runs the callback after two rAFs, or immediately if rAF is unavailable. `landNow()` can flush a pending landing before another navigation.

See [completion](completion.md) for hold release and cleanup, and [binding lifecycle and DOM protocol](../binding-lifecycle-and-dom-protocol.md) for teardown behavior.

## Historical early-landing description

This former placement rationale does not describe the current implementation:

Early landing releases the arrival hold when every participant is within one CSS pixel or alpha step, using a DPR-1 band at or before the cut. This places reveal layout and paint beneath the subpixel tail. Early landing follows the cut's disarm rules.
