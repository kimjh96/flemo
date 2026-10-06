# Motion behavior

Do not infer flemo behavior from other shared-element libraries.

| Concern | flemo contract | Source |
| --- | --- | --- |
| Movement and scaling | The box animates; its subtree lays out at every intermediate size. | `morph/morphKeyframes.ts` |
| Growing boxes with stationary contents | Layout occurs once at the larger end, with contents clipped into view, only when the box clips overflow and every computed arrival property and carried departure paint channel is proven not to paint against the box. A shadow, border, outline, image, mask, filter, transform, percentage corner, ellipsis, pseudo-element, or unknown property forces layout every frame. | `morph/morphReveal.ts` |
| Departure | The departure is cut and pinned at its `exit` end pose from the transition's first frame; both ends do not cross-fade. | `morph/attachMorph.ts` (`CUT FROM THE FIRST FRAME`) |
| Moving participant | The arriving element moves. On pop, this is the element on the screen being returned to. | `morph/attachMorph.ts` (`arrivingActive`) |
| Active state | `active` follows the stack. On pop, the dismissing screen remains top and `true`. | `transition/morphTransition/createMorphTransition.ts` |
| Transition layer | The element moves to the transition layer because its screen clips, covers, and drags descendants. | `morph/morphLayer.ts` |
| Stacking | The transition layer is a sibling of every screen container and paints above them. Nothing inside a scope can outrank a transition. Chrome that must stay in front belongs outside the scope; today only a lifted `Part` is outside it. | `react/src/Router.tsx`, `dom/stacking.ts` |
| Screen transitions | A morph leaves the screen and moves independently but borrows its clock; see [Clocks](../timing-options.md#clocks). | `morph/attachMorph.ts` header |
| Part layout | A `<Part>` lays out once at its resting width; growth clips it instead of re-wrapping it. | `morph/pinParts.ts` |
| Repeated text | A container Morph's ghost paints departure glyphs over arrival glyphs. Pair repeated text as a nested Morph with `name="text"`. | `morph/attachMorph.ts` (`paired descendant`, `NESTED`) |
| Text layout and typography | A non-replaced inline line box can stay at its destination while the runtime computes travel. Put typography on a transformable Morph box and preserve surrounding space in a holder. | `Morph.tsx`, `morph/attachMorph.ts` (`WHERE THE TRANSITION BEGINS`) |
| Different copy | A Morph asserts one identity. Keep the continuously shared item as a Morph; hand different eyebrow, summary, or controls over as Parts beside it. | `morph/attachMorph.ts`, `transition/partTransition/createPartTransition.ts` |
| Timing ownership | Parts, decorators, and morphs inherit the transition's clock by variant key. | [Clocks](../timing-options.md#clocks) |
