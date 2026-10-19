# Shared-bar staging, cancel recovery, and swipe lifecycle

This supplement describes `barPartStaging.ts`, `cancelResume.ts`, and `createSwipeController.ts` in `packages/core/src/core/engine/`. Read it alongside [the module inventory](modules.md), [single resolution](resolution.md), and [inline leases](inline-leases.md).

## Shared-bar part staging

Shared bars can remain stationary while their screens move, but the covered screen's parts would otherwise cross-fade beneath the upper screen. Callers stage the passive side's matched-bar parts in the Router's part layer. The layer takes no pointer input and uses `PART_LAYER_LEVEL = 2147482000`, intended to sit above screens and below morphs.

A bar qualifies when its riding attribute is already `false`, or another DOM bar matches its Router, bar kind, ID, and ID type. This synchronous DOM fallback avoids waiting for effect-driven registration to settle. The predicate excludes the same bar element; it does not explicitly compare screen identities.

Staging requires a layer, a screen identity, and matching parts. Each part must have positive `offsetWidth` and `offsetHeight`; hidden or otherwise unmeasurable parts stay home. A hidden, noninteractive stand-in preserves the border-box dimensions and computed margins, with `flex: 0 0 auto`.

Insert the stand-in before moving the part, then measure the stand-in after the move and convert its rectangle into layer space. Measuring the animated part would count its transformed starting pose twice; measuring the stand-in while both boxes occupy the bar would use the wrong position. The staged part receives absolute border-box geometry, zero margins, and a home marker identifying its screen for participant collection.

Reparenting announces an expected animation cancellation and uses `preserveAnimations` with `includeRoot: true`. The mover owns clock preservation; cancel recovery must not overwrite an authored delay for this move.

Mirror the owning screen's hold onto the layer so staged parts remain on the screen's release clock. A symbol token identifies the current layer hold owner. An older release removes the layer hold attribute only if its token still owns it.

Release is idempotent. It disconnects the mirror, clears the stranded timer, removes home markers, and restores each part's exact original style attribute, including absence of the attribute. A connected stand-in is replaced atomically with its part; otherwise restoration uses the captured parent and next sibling. If the original parent is disconnected, remove the part and stand-in. Returning parts also preserves animations and announces the expected cancellation. Callers supply the stranded deadline; the swipe controller uses 60 seconds.

## Compiled-animation cancellation

`wireCancelResume` listens for cancellation of the configured element and matching transition animation name. It ignores other targets and names, synchronous events during its own restart, an announced expected cancellation, and cancellations that already have a live matching successor. A successor must be neither idle nor finished. This prevents a keyframe swap or asynchronously delivered restart cancellation from consuming the recovery budget repeatedly.

`RESUME_BUDGET` is four; callers supply budget accounting and liveness. A dead participant or exhausted budget invokes `onTerminal`. A positive-duration animation whose active elapsed time has reached its duration also terminates.

The resume position comes from `animationcancel.elapsedTime`, clamped to nonnegative milliseconds. It represents active-phase time, excluding authored delay. Recovery drops the animation, forces reflow, and restores the compiled rule:

- At zero active elapsed time, restart without changing the inline delay. The authored delay replays in full because the event provides no position within its delay phase.
- After active motion begins, lease `animation-delay` under the configured writer and set it to the negative active elapsed time. Do not add the authored delay again.
- A zero-duration variant bypasses the positive-duration end test so delay-only authoring can replay.

Detaching restores a rejoin delay written by this controller through the inline lease, preventing an interruption from carrying that offset into a later transition. The watchdog's `fullRestart` explicitly removes the inline delay and restarts from the compiled beginning. Task-resolution ownership remains the caller's responsibility.

## Swipe recognition and pointer lifetime

The binding supplies live configuration, readiness, elements, navigation, and optional gesture callbacks. It forwards pointer events and calls `abandon` when the screen unmounts or freezes.

Ignore secondary pointers and non-left mouse buttons. A new eligible primary pointer first abandons stale gesture state, before testing readiness. Intent resolves once after 8 CSS pixels: motion must be positive on the declared axis and exceed the cross-axis movement by more than 3:1. Rejected intent is not reconsidered later in the same pointer stream. Scrollable discovery and edge conditions further constrain acquisition; a viewport scroll height above 10 blocks starting or following.

An acquired gesture captures the pointer and suppresses native selection and drag events. Pointer release, cancellation, rejected start, and abandonment remove that suppression. Lost capture cancels only when its target is the owning scope; a child's bubbling capture-transfer event must not cancel a newly acquired touch gesture.

## Following and participant readiness

The previous screen is resolved from the immediately preceding sibling container. Own-child queries keep bar and decorator lookup from selecting nested Router chrome. Shared-bar metadata has a DOM fallback while registration catches up. Riding shared bars resolve percentage vertical travel against the screen's height; layer riders retain their own targets.

Declared screen dragging stages both screens and their riding bars as scrubbed motion. Optional drag destinations can supply intermediate stops while retaining the pop clock as the release ceiling. Inline hooks cannot also write scrub-owned screens or bars; their other targets remain writable.

The controller samples velocity on every pointer move over an 80 ms window but follows only the latest pending event once per animation frame. Progress uses the dragged screen's axis span, with a viewport fallback, and clamps travel from zero to that span. Part and decorator hooks receive 0 to 100; the morph callback receives 0 to 1. Screen-specific progress drives automatic riders, whose phase includes the corresponding screen's easing and duration.

A frozen returning screen delays following until it is displayed and a subsequent frame can run, capped at 200 ms. A screen already displayed at acquisition needs no reveal wait. Release flushes a pending follow synchronously and bypasses the reveal hold.

Bar-part staging, automatic part riders, and decorator riders have separate readiness conditions. A drag keeps navigation status at COMPLETED, so it must stage covered bar parts itself. Failed staging is retried as the screen becomes measurable. Automatic riders are rearmed when their nodes become stale; a pure addition alone does not trigger that mechanism. Parts with authored swipe hooks retain hook ownership.

Decorator lookup can recover a disconnected previous handle through an own-child lookup or owner attribute query. Automatic collection chooses one decorator per side, preferring supplied or resolved handles. It does not iterate every owner-matched copy. Promotions track decorator elements so replacements can also be released.

## Release and cleanup

A normal release adds its final pointer sample to the velocity window, allowing a stationary hold to reduce measured speed. Forced cancellation uses neutral input for the handler verdict but retains real offset for the return distance. Only movement below the 6 px tap slop makes settling instantaneous; forced cancellation alone is not a tap.

Release timing uses remaining distance, recent speed, the authored duration ceiling, and easing. A deliberate return flick requires negative axis velocity of at least 300 px/s. Hook-driven writes can reaim easing to match launch speed. Decorator release scaling borrows the screen ceiling and distance curve while retaining its authored easing; part hooks retain their own ceilings.

Whoever owns the screens owns the release. A hook-owned screen path supplies its verdict and landing. When flemo owns the screens, it computes the threshold or velocity verdict and clock, informs hooks, and ignores their returned verdict. Settle reporting is once-only and shares the chosen duration with screen scrubs, automatic riders, and the morph callback. Navigation waits for staged screens to land.

On commit, mark the outgoing scope and decorator to skip the subsequent pop animation, restore staged parts before `back()`, and release drag promotions under the swipe owner's token after navigation. Previous-side hook-written part landing values remain for engine COMPLETED cleanup. On cancellation, restore inline leases, release riders and promotions, return staged parts, and reset drag status to IDLE.

The source records device observations that iOS Low Power Mode limits main-thread following to 30 Hz even while untouched compositor animation can remain smoother. It also records unsuccessful pacing approaches and a rejected scroller-based structure. These are source-recorded experimental boundaries, not new device verification performed for this document.
