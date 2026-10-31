# Swipe lifecycle

`createSwipeController.ts` in `packages/core/src/core/engine/` manages swipe recognition, following, release, and cleanup. Its binding supplies live configuration, readiness, elements, navigation, and optional gesture callbacks, forwards pointer events, and calls `abandon` when the screen unmounts or freezes.

## Recognition and pointer lifetime

Ignore secondary pointers and non-left mouse buttons. A new eligible primary pointer abandons stale gesture state before testing readiness.

Intent resolves once after 8 CSS pixels: motion must be positive on the declared axis and exceed cross-axis movement by more than 3:1. Rejected intent is not reconsidered in the same pointer stream. Scrollable discovery and edge conditions further constrain acquisition; a viewport scroll height above 10 blocks starting or following.

An acquired gesture captures the pointer and suppresses native selection and drag events. Pointer release, cancellation, rejected start, and abandonment remove that suppression. Lost capture cancels only when its target is the owning scope; a child's bubbling capture-transfer event must not cancel a newly acquired touch gesture.

## Following and participant readiness

The previous screen is resolved from the immediately preceding sibling container. Own-child queries keep bar and decorator lookup from selecting nested Router chrome. Shared-bar metadata has a DOM fallback while registration catches up. Riding shared bars resolve percentage vertical travel against the screen's height; layer riders retain their own targets.

Declared screen dragging stages both screens and their riding bars as scrubbed motion. Optional drag destinations can supply intermediate stops while retaining the pop clock as the release ceiling. Inline hooks cannot also write scrub-owned screens or bars; their other targets remain writable.

The controller samples velocity on every pointer move over an 80 ms window, but follows only the latest pending event once per animation frame. Progress uses the dragged screen's axis span, with a viewport fallback, and clamps travel from zero to that span. Part and decorator hooks receive 0 to 100; the morph callback receives 0 to 1. Screen-specific progress drives automatic riders, whose phase includes the corresponding screen's easing and duration.

A frozen returning screen delays following until it is displayed and a subsequent frame can run, capped at 200 ms. A screen already displayed at acquisition needs no reveal wait. Release flushes pending follow synchronously and bypasses the reveal hold.

Bar-part staging, automatic part riders, and decorator riders have separate readiness conditions. A drag keeps navigation status at COMPLETED, so it must stage covered bar parts itself. Failed staging is retried as the screen becomes measurable. Automatic riders are rearmed when their nodes become stale; a pure addition alone does not trigger this mechanism. Parts with authored swipe hooks retain hook ownership.

Decorator lookup can recover a disconnected previous handle through an own-child lookup or owner attribute query. Automatic collection chooses one decorator per side, preferring supplied or resolved handles; it does not iterate every owner-matched copy. Promotions track decorator elements so replacements can also be released.

## Release input and timing

A normal release adds its final pointer sample to the velocity window, allowing a stationary hold to reduce measured speed. Forced cancellation uses neutral input for the handler verdict but retains real offset for the return distance. Only movement below the 6 px tap slop makes settling instantaneous; forced cancellation alone is not a tap.

Release timing uses remaining distance, recent speed, the authored duration ceiling, and easing. A deliberate return flick requires negative axis velocity of at least 300 px/s. Hook-driven writes can reaim easing to match launch speed. Decorator release scaling borrows the screen ceiling and distance curve while retaining its authored easing; part hooks retain their own ceilings.

## Rider animation continuity

A drag stages one paused animation per rider and nothing else. A rider whose only transform is a two-pose slide on one axis is seeked to the time nearest the finger that puts it on a whole device pixel, so a slow parallax side is never held at a fractional offset. An unmeasurable rider, such as a screen waking from `display: none`, is seeked unaligned until measurable.

The release is born running at the pose on screen. `riderSwipe` reads every rider's computed pose before changing any animation, cancels the drag animation, and creates one animation in the same task: the rest of the path, on the rest of the authored cubic-bezier (`splitCubicBezier`), lasting the release duration.

Nothing is written into its clock after birth: WebKit does not keep a held animation on the compositor once its time, rate, or start is rewritten. A curve without handles, or a pose the host does not report, falls back to the whole path born with a negative delay.

## Release ownership and cleanup

Whoever owns the screens owns the release. A hook-owned screen path supplies its verdict and landing. When flemo owns the screens, it computes the threshold or velocity verdict and clock, informs hooks, and ignores their returned verdict. Settle reporting is once-only and shares the chosen duration with screen scrubs, automatic riders, and the morph callback. Navigation waits for staged screens to land.

On commit, mark the outgoing scope and decorator to skip the subsequent pop animation, restore staged parts before `back()`, and release drag promotions under the swipe owner's token after navigation. Previous-side hook-written part landing values remain for engine COMPLETED cleanup.

On cancellation, restore inline leases, release riders and promotions, return staged parts, and reset drag status to IDLE.

## Evidence boundary

The source records device observations that iOS Low Power Mode limits main-thread following to 30 Hz even while untouched compositor animation can remain smoother. It also records unsuccessful pacing approaches and a rejected scroller-based structure. These are source-recorded experimental boundaries, not new device verification performed for this document.
