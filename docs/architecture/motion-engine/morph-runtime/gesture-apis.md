# Gesture-facing APIs

These contracts describe the supplied `packages/core/src/morph/attachMorph.ts`; see the [assessment scope and references](../morph-runtime.md).

`stageHeldTransitions(store, status)` captures current snapshots, evaluates connected registrations under the forced direction, and synchronously returns the runs currently in the map. Nested evaluation can still be queued in a microtask, so the return does not guarantee that every nested run has been created. The function delegates paused scrubbing to gesture integration; its body does not seek every returned animation to zero.

`heldTransitions(store)` returns the current scope runs, including nested runs registered since staging. It returns the map's current values, not a live collection.

`markGestureDelivered(store)` marks currently running keys so committed navigation does not repeat a gesture's completed travel. Evaluation consumes a mark when it finds that key already moving or when the arriving side would otherwise stage it. The departing-side gate does not consume a completed delivery.

`clearGestureDeliveries(store)` clears stale marks for a new gesture; staging does not clear them indiscriminately.
