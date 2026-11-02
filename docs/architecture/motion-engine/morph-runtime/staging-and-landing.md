# Staging, holds, and landing

These contracts describe the supplied `packages/core/src/morph/attachMorph.ts`; see the [assessment scope and references](../morph-runtime.md).

## Staging and hand-over

Top-level arrivals move into the resolved morph layer. The runtime sets its pointer events to none and z-index to 2147483000; the binding remains responsible for layer bounds. A hidden, inert clone reserves the arrival's original layout. The clone and its descendants lose morph and Part markers, IDs, names, test IDs, and inline animation declarations.

The arrival's original style attribute is captured for exact restoration, including its absence. Inherited typography and color are carried into the layer, with pixel line height converted to a ratio when possible. During travel, the runtime removes size clamps, zeros margins, and applies layout containment. It delegates animation preservation during reparenting to `preserveAnimations`.

The departure receives a cut with zero delay and both fade endpoints set to the authored exit end pose. This is not a fade window that can leave a second moving copy visible.

A connected distinct departure produces a ghost when cross-fade is positive or a head needs coverage. Zero cross-fade with zero head creates no ghost. Under a headed cut without authored entry content declarations, arrival opacity stays at 0.006 until the step hand-over. The ghost keeps the departure's computed inherited values, strips identifying markers, and hides Morph descendants in the copy; actual paired descendants must supply their own visible motion. Positive cross-fade removes the ghost's surface paint; a cut retains it to cover the head.

For `carry: "screen"`, the camera selects the physical screen at the smaller-area endpoint, independent of navigation direction. Nested runs do not create cameras. A screen-moving owner triggers the camera override warning. Camera transform origin is read and converted into layer coordinates rather than assumed.

## Hold sources

The implementation collects nearest hold-bearing ancestors from the arrival owner, its physical screen, and the departure owner. It removes duplicates and excludes the layer and anything inside it before calling `mirrorHold(layer, holdSources)`, avoiding observation of the layer that the mirror writes.

The source's intended contract is that any held end keeps the morph paused, including when the ends have different hold states. This is more specific than mirroring only the arriving screen. The supplied call establishes which sources are passed; strength selection and observation inside `mirrorHold` are not independently verified here.

## Landing and retained residue

Top-level and nested runs listen for their geometry animation name and ignore zero-elapsed ends when duration is positive. Their initial backstop runs after start plus duration plus 250 ms. `MorphRun` exposes `suspendBackstop()` and `armBackstop(seconds)` so a gesture can suspend the normal deadline and later arm a release deadline.

Top-level finish is idempotent. It disconnects the hold mirror, removes the layer hold, releases pinned Parts, restores the exact arrival style, and returns the element through its stand-in when home remains connected. Otherwise it removes the arrival. It removes the stand-in, shadow carrier, ghost, and arrival role and deletes the run.

The departure cut and camera can outlive travel. Residue releases immediately if the partner is disconnected or the store is already nontransitional at landing. Otherwise the runtime records residue callbacks, subscribes for a nontransitional status, and sets a stranded timeout of start plus duration plus 1000 ms from that registration. A later run can supersede this residue. Camera marker removal checks ownership. Rule disposal is scheduled on the next animation frame when available, or performed immediately without rAF.
