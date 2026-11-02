# Shared-bar part staging

`barPartStaging.ts` in `packages/core/src/core/engine/` stages the passive side's matched-bar parts in the Router's part layer. Shared bars can remain stationary while their screens move; without staging, the covered screen's parts would cross-fade beneath the upper screen. The layer takes no pointer input and uses `PART_LAYER_LEVEL = 2147482000`, intended to sit above screens and below morphs.

## Qualification and geometry

A bar qualifies when its riding attribute is already `false`, or another DOM bar matches its Router, bar kind, ID, and ID type. This synchronous DOM fallback avoids waiting for effect-driven registration. The predicate excludes the same bar element but does not explicitly compare screen identities.

Staging requires a layer, a screen identity, and matching parts. Each part must have positive `offsetWidth` and `offsetHeight`; hidden or otherwise unmeasurable parts stay home. A hidden, noninteractive stand-in preserves border-box dimensions and computed margins with `flex: 0 0 auto`.

Insert the stand-in before moving the part, then measure the stand-in after the move and convert its rectangle into layer space. Measuring the animated part would count its transformed starting pose twice; measuring the stand-in while both boxes occupy the bar would use the wrong position. The staged part receives absolute border-box geometry, zero margins, and a home marker identifying its screen for participant collection.

## Animation and hold ownership

Reparenting announces an expected animation cancellation and uses `preserveAnimations` with `includeRoot: true`. The mover owns clock preservation; cancel recovery must not overwrite an authored delay for this move.

Mirror the owning screen's hold onto the layer so staged parts remain on the screen's release clock. A symbol token identifies the current layer hold owner. An older release removes the layer hold attribute only if its token still owns it.

## Restoration

Release is idempotent. It disconnects the mirror, clears the stranded timer, removes home markers, and restores each part's exact original style attribute, including its absence.

Replace a connected stand-in atomically with its part; otherwise use the captured parent and next sibling. If the original parent is disconnected, remove the part and stand-in. Returning parts also preserves animations and announces the expected cancellation.

Callers supply the stranded deadline; the swipe controller uses 60 seconds.
