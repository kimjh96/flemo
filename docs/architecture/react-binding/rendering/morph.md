# Morph

`Morph.tsx` and `MorphLayer/` implement a shared element: the same thing on two screens, paired by `layoutId`. `Morph.tsx` is deliberately twenty lines: it renders a slot and box and calls core's `attachMorph` in a layout effect. It re-registers on every status change as required by the runtime contract, letting an unfrozen previous screen participate in a pop.

Core's `src/morph` owns pairing, measured travel, per-transition keyframes, and cleanup. It reads the DOM PROTOCOL rather than stores, allowing a Solid or Svelte binding to use the same twenty-line approach.

## Binding contracts

1. During transition, the element moves into `MorphLayer` and returns on landing. Router renders the layer because only it knows whether its box is the viewport or a contained region. Remaining inside a screen would clip, cover, and drag the element with that screen; leaving the descendant relationship avoids all three. A morph requires no particular screen transition.
2. The slot protects React: React must never remove a node from a location other than where it left it. The slot stays in place and takes removal while the box moves. At rest it uses `display: contents`.
3. On POP, the arriving screen has `data-flemo-active="false"`. The flag follows stack position, not travel direction; the dismissing screen retains `"true"` until landing.
4. The layer mirrors the arriving screen's `data-flemo-anim-hold`. The same compiled rule pauses morph and screen, starting both on the same frame without timing code on either side.
