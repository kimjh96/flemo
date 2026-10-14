# Morph runtime lifecycle and synchronization

This supplement describes the supplied `packages/core/src/morph/attachMorph.ts`. Read it alongside [the motion engine](../motion-engine.md), [React's Morph binding](../react-binding/rendering/morph.md), and [motion behavior](../../instructions/transition-authoring/semantics/motion-behavior.md). Its executable branches establish the caller behavior described here. Imported helpers and browser behavior have not been independently verified, and no tests were executed for this assessment. Device measurements in source comments are recorded observations, not new verification.

## Registration and ownership

Call `attachMorph` before the mounted element's first paint and again when its screen changes status. Supply the Router's navigate store, a pairing key, and optionally a registered transition name and ownership. Keys are normalized with `String(layoutId)`, so numeric and string forms of the same value share a key. Scope state is keyed by navigate store and contains registrations, snapshots, running transitions, residue releases, and gesture delivery marks.

The returned disposer removes only its own current registration. It does not finish motion: effect cleanup during status changes must not abort the run that the next registration participates in.

The runtime distinguishes the transition owner from the physical screen. An element with both status and active attributes answers ownership itself; otherwise ownership comes from its nearest screen. A nearest screen belonging to another Router is not a physical screen the morph may drive as a camera. Registration uses supplied ownership when the DOM walk cannot answer and removes redundant element ownership when the enclosing screen belongs to the same Router.

Only nested, unstaged elements receive a registration-time rest-size measurement. A positive measurement is retained for later nested sizing; a staged re-registration preserves the previous cached size instead of treating the animated box as rest. Morph name and ID attributes are written only when their values change.

## Pairing and interruption order

Only the arriving side starts a run. Arrival is active `false` on POPPING and active `true` on other transitional statuses. A nested element riding a live container run uses that container instead of resolving a screen owner.

On a store status change into a transitional state, the scope captures snapshots before finishing existing runs. This preserves the interrupted position rather than measuring the position after restoration. Capture first removes role-bearing layer elements absent from the live-run map, prunes snapshots whose elements disconnected, and measures connected registrations, preferring the active side over an existing snapshot.

Evaluation prefers an eligible stored snapshot, then falls back to `measurePartnerNow()`. That fallback calls `resolveMorphSide()` to measure the departure before calling `startMorphRun()`. A normal partner must be connected and on the opposite transitioning side. Gesture evaluation bypasses the transitional-status requirement; snapshot evaluation also tolerates a status attribute that has not yet flipped. Role-bearing elements outside the morph layer are accepted directly. Inside the layer, a role-bearing element must belong to a live run. An element with no owning screen is also permitted.

Inside `startMorphRun()`, after resolving a usable transition and entry motion, residue on both pair elements is released before measuring the arrival and recording its restoration style. This ordering prevents a previous cut from becoming the new arrival's restored hidden state. It does not precede every endpoint measurement: capture and the late partner fallback have already measured the departure. A camera's previous residue is separately released before stamping its new camera marker.

Missing usable partners or nonpositive endpoint dimensions decline motion. An unknown transition name warns when the transition registry is nonempty and falls back to the built-in shared preset; if no usable transition exists, no run starts.

## Timing, geometry, and synchronization

A top-level run uses authored duration when supplied, otherwise the resolved screen duration; a nonpositive resulting duration falls back to 0.4 seconds. A moving screen's easing takes precedence so the morph follows its moving destination. Otherwise the morph's authored easing takes precedence over the screen's easing. Delay includes the routing head. A nested run inherits its carrier's duration, easing, start, and head.

Two separate decisions govern geometry and its followers:

- `travelPinned = ensurePinnedPoses()` is passed to the arrival and nested keyframe builders to request registered-property geometry. The source describes a left/top fallback when registration is unavailable.
- After building the arrival, `pinned = !arriving.geometryAccelerated && ensurePinnedPoses()` determines whether follower poses must track nonaccelerated geometry. This value is passed to ghost and nested keyframe construction. The camera receives `accelerated: !pinned`.

The caller therefore lets the arrival builder's geometry verdict govern follower synchronization; it does not unconditionally force every morph onto one rendering path. The source comments explain that independently accelerated ghost or camera transforms can advance while layout-driven geometry stalls. The helper implementations and actual browser scheduling are outside this assessment.

The caller computes typography channels for font size, weight, letter spacing, word spacing, and line height, and requests leading and tracking corrections from helpers. Paint channels come from the paint helper. Pixel corner values are converted to proportions only when both boxes are within 10 percent of square and both corner lists parse as pixel lengths. Percentage corners disable the contents-hold request. Reveal eligibility, content stability, image handling, shadow output, and emitted keyframes depend on imported helpers.

## Nested composition

An enclosing Morph causes evaluation to wait one microtask so child-first registration can allow the container to start first. If a live enclosing run exists, the child stays inside it and inherits its clock. The child can correct its initial position, typography, aspect ratio, spacing, paint, and non-text size. Size interpolation ends at the cached rest size when available, rather than the size measured inside an already staged container. With no relevant changes, the nested branch returns without creating a run.

Nested runs restore their captured inline style and clear their role when they finish. They have their own geometry-end listener and backstop and appear in the scope's transition map.

## Staging and hand-over

Top-level arrivals move into the resolved morph layer. The runtime sets that layer's pointer events to none and z-index to 2147483000; the binding remains responsible for its bounds. A hidden, inert clone reserves the arrival's original layout. The clone and its descendants lose morph and Part markers, IDs, names, test IDs, and inline animation declarations.

The arrival's original style attribute is captured for exact restoration, including its absence. Inherited typography and color are carried into the layer, with pixel line height converted to a ratio when possible. The runtime removes size clamps during travel, zeros margins, and applies layout containment. It delegates animation preservation during reparenting to `preserveAnimations`.

The departure receives a cut whose two fade endpoints are both the authored exit end pose, with zero delay. It is not a fade window that can leave a second moving copy visible.

A connected distinct departure produces a ghost when cross-fade is positive or a head needs coverage. Zero cross-fade with zero head creates no ghost. Under a headed cut without authored entry content declarations, the arrival is held at opacity 0.006 until the step hand-over. The ghost keeps the departure's computed inherited values. It strips identifying markers and hides Morph descendants in the copy; the actual paired descendants must supply their own visible motion. Positive cross-fade removes the ghost's surface paint, while a cut retains it to cover the head.

For `carry: "screen"`, the camera selects the physical screen at the smaller-area endpoint, rather than choosing by navigation direction. Nested runs do not create cameras. A screen-moving owner triggers the camera override warning. Camera transform origin is read and converted into layer coordinates rather than assumed.

## Hold sources

The implementation collects nearest hold-bearing ancestors from the arrival owner, its physical screen, and the departure owner. It removes duplicates and excludes the layer itself and anything inside it before calling `mirrorHold(layer, holdSources)`. This avoids observing the layer that the mirror writes.

The source's intended contract is that any held end keeps the morph paused, including when the two ends have different hold states. This is more specific than mirroring only the arriving screen. The supplied call establishes which sources are passed; the strength-selection and observation behavior inside `mirrorHold` is not independently verified here.

## Landing and retained residue

Top-level and nested runs listen for their geometry animation name and ignore zero-elapsed ends when duration is positive. Their initial backstop runs after start plus duration plus 250 ms. `MorphRun` exposes `suspendBackstop()` and `armBackstop(seconds)` so a gesture can suspend the normal deadline and later arm a release deadline.

Top-level finish is idempotent. It disconnects the hold mirror, removes the layer hold, releases pinned Parts, restores the exact arrival style, and returns the element through its stand-in when home remains connected. Otherwise it removes the arrival. It removes the stand-in, shadow carrier, ghost, and arrival role and deletes the run.

The departure cut and camera can outlive travel. If the partner is disconnected or the store is already nontransitional at landing, residue releases immediately. Otherwise the runtime records residue callbacks, subscribes for a nontransitional status, and sets a stranded timeout of start plus duration plus 1000 ms from that registration. A later run can supersede this residue. Camera marker removal checks ownership. Rule disposal is scheduled on the next animation frame when available, or performed immediately without rAF.

## Gesture-facing APIs

`stageHeldTransitions(store, status)` captures current snapshots, evaluates connected registrations under the forced direction, and synchronously returns the runs currently in the map. Nested evaluation can still be queued in a microtask, so that return is not a promise that every nested run has already been created. The function delegates paused scrubbing to the gesture integration; its body does not itself seek every returned animation to zero.

`heldTransitions(store)` returns the current scope runs, including nested runs that have since been registered. It returns the map's current values, not a live collection.

`markGestureDelivered(store)` marks the keys currently running so committed navigation does not repeat a gesture's completed travel. Evaluation consumes a mark when it finds that key already moving or when the arriving side would otherwise stage it. The departing-side gate does not consume a completed delivery. `clearGestureDeliveries(store)` clears stale marks for a new gesture; staging does not clear them indiscriminately.
