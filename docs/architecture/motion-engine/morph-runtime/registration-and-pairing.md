# Registration, pairing, and interruption

These contracts describe the supplied `packages/core/src/morph/attachMorph.ts`; see the [assessment scope and references](../morph-runtime.md).

## Registration and ownership

Call `attachMorph` before the mounted element's first paint and again when its screen changes status. Supply the Router's navigate store, a pairing key, and optionally a registered transition name and ownership. Keys normalize through `String(layoutId)`, so numeric and string forms of the same value share a key. Scope state is keyed by navigate store and contains registrations, snapshots, running transitions, residue releases, and gesture delivery marks.

The returned disposer removes only its own current registration. It does not finish motion: effect cleanup during status changes must not abort the run that the next registration participates in.

Transition ownership and physical screen identity are distinct. An element with both status and active attributes answers ownership itself; otherwise ownership comes from its nearest screen. A nearest screen belonging to another Router is not a physical screen the morph may drive as a camera. Registration uses supplied ownership when the DOM walk cannot answer and removes redundant element ownership when the enclosing screen belongs to the same Router.

Only nested, unstaged elements receive a registration-time rest-size measurement. Positive measurements are retained for later nested sizing. Staged re-registration preserves the previous cached size instead of treating the animated box as rest. Morph name and ID attributes are written only when their values change.

## Pairing and interruption order

Only the arriving side starts a run: active `false` on POPPING and active `true` on other transitional statuses. A nested element riding a live container run uses that container instead of resolving a screen owner.

When store status enters a transitional state, the scope captures snapshots before finishing existing runs, preserving the interrupted position rather than the restored position. Capture first removes role-bearing layer elements absent from the live-run map, prunes snapshots whose elements disconnected, and measures connected registrations, preferring the active side over an existing snapshot.

Evaluation prefers an eligible stored snapshot, then falls back to `measurePartnerNow()`. The fallback calls `resolveMorphSide()` to measure the departure before calling `startMorphRun()`.

A normal partner must be connected and on the opposite transitioning side. Gesture evaluation bypasses the transitional-status requirement; snapshot evaluation also tolerates a status attribute that has not yet flipped. Role-bearing elements outside the morph layer are accepted directly; inside the layer, they must belong to a live run. An element with no owning screen is also permitted.

Inside `startMorphRun()`, after resolving a usable transition and entry motion, residue on both pair elements is released before measuring the arrival and recording its restoration style. This prevents a previous cut from becoming the new arrival's restored hidden state. It does not precede every endpoint measurement: capture and the late partner fallback have already measured the departure. A camera's previous residue is separately released before stamping its new camera marker.

Missing usable partners or nonpositive endpoint dimensions decline motion. An unknown transition name warns when the transition registry is nonempty and falls back to the built-in shared preset. If no usable transition exists, no run starts.
