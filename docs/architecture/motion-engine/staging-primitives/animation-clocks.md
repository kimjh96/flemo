# Animation clocks

## Matching and restoration

`preserveAnimations(root, move, options)` collects eligible clocks, calls `move`, invalidates the shared animation snapshot, and seeks matching animations in the resulting subtree. It returns the number of saved keys, not successful seeks. The move runs even when nothing is saved or the document lacks `getAnimations`.

Eligibility requires an effect target that is an `Element`, a nonempty string `animationName`, and numeric `currentTime`. This name-based filter is intended for CSS animations; ordinary script-driven animations are left alone. Only numeric time is saved. Play state, playback rate, and other animation settings are not explicitly captured or restored.

Matching uses subtree document-order position plus animation name. The root is position zero; descendants follow `querySelectorAll("*")` order. Descendant node identity need not survive, but subtree ordering must remain compatible across the move. Animations sharing a position and name share one saved key; the last collected time wins. After the callback, the function continues to inspect the original root object.

Root animations are excluded by default so morph runtime remains their author. `includeRoot: true` also carries the root's clocks, as staged Parts require. Missing post-move matches are skipped. Refused `currentTime` assignments are caught, leaving that animation's restart in place. Preservation is best effort.

## Snapshot lifetime and cost

The helper enumerates `root.ownerDocument.getAnimations()` and groups animations by target. Subtree collection filters this map by root identity or containment. A module-level snapshot shares the enumeration until a queued microtask clears it. Every completed move also clears it before post-move collection, because reparenting can cancel and recreate animations. Post-move enumeration is skipped when no clocks were saved.

The cache is one module-wide map, not keyed by document. Calls involving different owner documents before invalidation can reuse another document's snapshot. Other animation changes during that interval do not independently invalidate it. The source does not establish cross-document cache isolation.

Source comments attribute repeated animation queries to costly style recalculation and record measured staging and landing costs. These observations explain the optimization; they are not benchmarks executed for this assessment. No tests or browser checks were performed here.
