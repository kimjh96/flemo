# Shared staging geometry and animation clocks

`packages/core/src/dom/staging.ts` provides coordinate conversion and CSS animation clock preservation for morph and shared-bar Part staging. It lives in `dom` because morph already imports the engine; engine staging must not introduce a reverse dependency into morph. See [shared-bar staging and swipe lifecycle](staging-and-swipe.md) for the Part caller's ownership and cleanup.

## Layer coordinates

`StagingRect` contains `x`, `y`, `width`, and `height`. `intoLayerSpace` reads the layer's bounding rectangle and compares its painted dimensions with `offsetWidth` and `offsetHeight`, independently for each axis.

A nonpositive laid-out dimension produces scale 1. A painted-versus-laid-out difference of at most 0.5 pixels also produces scale 1, avoiding false scale correction from integer-rounded layout measurements. Otherwise the scale is painted size divided by laid-out size, falling back to 1 for a falsy ratio. Position is translated by the layer's left/top and divided by the corresponding scale; dimensions are divided by that scale.

This is axis-wise scale and translation conversion, not a general inverse transform. The tolerance deliberately ignores sufficiently small real scale differences too. Source comments report fractional-layout landing errors on an iPhone; no new device verification accompanies this document.

## Animation matching and restoration

`preserveAnimations(root, move, options)` collects eligible clocks, calls `move`, invalidates the shared animation snapshot, and seeks matching animations in the resulting subtree. It returns the number of saved keys, not the number of successful seeks. The move still runs when nothing is saved or the document lacks `getAnimations`.

Eligibility requires an effect target that is an `Element`, a nonempty string `animationName`, and numeric `currentTime`. This name-based filter is intended for CSS animations; ordinary script-driven animations are left alone. Only numeric time is saved. The helper does not explicitly capture or restore play state, playback rate, or other animation settings.

Matching uses subtree document-order position plus animation name. The root is position zero and descendants follow `querySelectorAll("*")` order. This avoids requiring descendant node identity to survive, but assumes compatible subtree ordering across the move. Multiple animations with the same position and name share one saved key, with the last collected time winning. The function continues to inspect the original root object after the callback.

Root animations are excluded by default so morph runtime remains their author. `includeRoot: true` also carries the root's own clocks, as required by staged Parts. A missing post-move match is skipped. A refused `currentTime` assignment is caught and leaves that animation's restart in place; preservation is best effort.

## Snapshot lifetime and cost

The helper enumerates `root.ownerDocument.getAnimations()` and groups animations by target. Subtree collection filters that map by root identity or containment. A module-level snapshot shares this enumeration until a queued microtask clears it. Every completed move also clears it before post-move collection, because reparenting can cancel and recreate animations. When no clocks were saved, post-move enumeration is skipped.

The cache is a single module-wide map, not keyed by document. Calls involving different owner documents before invalidation can therefore reuse another document's snapshot. Other animation changes within that interval do not independently invalidate it. This source does not establish cross-document cache isolation.

Source comments attribute repeated animation queries to costly style recalculation and record measured staging and landing costs. Those observations explain the optimization; they are not benchmarks executed for this assessment. No tests or browser checks were performed here.
