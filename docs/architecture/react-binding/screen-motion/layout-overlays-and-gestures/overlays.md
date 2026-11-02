# Overlay host and decorator placement

Only screens without an inherited layer host render a host. Nested screens reuse the outermost host while publishing their own `LayerOwner` value. Host state, rather than a ref alone, makes target availability trigger rendering.

The host is an absolute, full-size sibling of the animated scope with `OVERLAY_LEVEL` and `pointerEvents: none`. It carries the screen's transition, status, active, and hold attributes, with no explicit containment or promotion.

Each owner value supplies stack position, paint-hidden state, transition name, status, active state, hold value, screen ID, whether the screen renders the host, and `registerSlot`. The supplied callback adds non-null slots to a Set; a null registration clears the entire Set. `hasLayerSlot` reflects whether the Set is nonempty. The unseen Layer consumer's registration behavior is unverified here.

The decorator renders locally without a registered slot, or through a portal at `zIndex * 2 + 1` with a registered slot and available host. These branches are exclusive, preventing simultaneous dims. If a slot registers before a host is available, neither branch renders. Both branches use the same decorator ref and hold attribute.

The engine receives the live outer `screenContainer` so core can discover layer riders. It resolves the Router's part layer through `resolvePartLayer(stores.navigate)`; the swipe controller resolves the same part layer. The binding does not hold a direct ref to every escaped overlay.
