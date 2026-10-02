# Motion behavior

Do not assume behavior from other shared-element libraries.

| Common expectation | flemo behavior | Source |
| --- | --- | --- |
| The element moves and scales | Its box animates; the subtree lays out at every intermediate size. | `morph/morphKeyframes.ts` |
| A growing box whose contents stay put is always resized | It lays out once at the larger end and clips into view only if it clips overflow and every computed arrival property and carried departure paint channel is proven not to paint against the box. A shadow, border, outline, image, mask, filter, transform, percentage corner, ellipsis, pseudo-element, or unknown property forces layout every frame. | `morph/morphReveal.ts` |
| Both ends cross-fade | The departure is cut, pinned at its `exit` end pose from the flight's first frame. | `morph/attachMorph.ts` (`CUT FROM THE FIRST FRAME`) |
| The departing element flies | The arriving element flies. On pop, this is the element on the screen being returned to. | `morph/attachMorph.ts` (`arrivingActive`) |
| `active` means arriving | `active` follows the stack. On pop, the dismissing screen remains top and `true`. | `transition/morphTransition/createMorphTransition.ts` |
| The element animates in place | It moves to the flight layer because its screen clips, covers, and drags descendants. | `morph/morphLayer.ts` |
| Screen stacking applies to a shared element | The flight layer is a sibling of every screen container and paints above them. Nothing inside a scope can outrank a flight. Chrome that must stay in front belongs outside the scope; today only a lifted `Part` is. | `react/src/Router.tsx`, `dom/stacking.ts` |
| Shared elements inherit screen transitions | A morph leaves the screen and moves independently but borrows its clock; see [Clocks](../timing-options.md#clocks). | `morph/attachMorph.ts` header |
| Content reflows as its box grows | A `<Part>` lays out once at its resting width; growth clips it instead of re-wrapping it. | `morph/pinParts.ts` |
| Repeated text can remain ordinary content in a container Morph | The container ghost paints departure glyphs over arrival glyphs. Pair repeated text as a nested Morph with `name="text"`. | `morph/attachMorph.ts` (`paired descendant`, `NESTED`) |
| Text Morphs can inherit typography and remain inline | A non-replaced inline line box can stay at its destination while the runtime computes travel. Put typography on a transformable Morph box and preserve surrounding space in a holder. | `Morph.tsx`, `morph/attachMorph.ts` (`WHERE THE FLIGHT BEGINS`) |
| Different copy at each end is also a Morph | A Morph asserts one identity. Keep the continuously shared item as a Morph; hand different eyebrow, summary, or controls over as Parts beside it. | `morph/attachMorph.ts`, `transition/partTransition/createPartTransition.ts` |
| Each participant owns timing | Parts, decorators, and morphs inherit the flight's clock by variant key. | [Clocks](../timing-options.md#clocks) |
