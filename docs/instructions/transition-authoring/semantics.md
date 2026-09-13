# Motion semantics and slots

## What flemo does differently

Do not assume behavior from other shared-element libraries.

| Common expectation | flemo behavior | Source |
| --- | --- | --- |
| The element moves and scales | Its box animates, so the subtree lays out at every intermediate size. | `morph/morphKeyframes.ts` |
| Both ends cross-fade | The departure is cut: pinned at its `exit` end pose from the flight's first frame. | `morph/attachMorph.ts` (`CUT FROM THE FIRST FRAME`) |
| The departing element flies | The arriving element flies; on pop, this is the element on the screen being returned to. | `morph/attachMorph.ts` (`arrivingActive`) |
| `active` means arriving | `active` follows the stack. On pop, the dismissing screen remains top and `true`. | `transition/morphTransition/createMorphTransition.ts` |
| The element animates in place | It moves to the flight layer because its screen clips, covers, and drags descendants. | `morph/morphLayer.ts` |
| The screen's own stacking still applies to a shared element | It cannot. The flight layer is a sibling of every screen container and paints above all of them, so nothing inside a scope outranks a flight. Chrome that must stay in front belongs outside the scope, and today only a lifted `Part` is. | `react/src/Router.tsx`, `dom/stacking.ts` |
| Shared elements inherit screen transitions | A morph leaves the screen and has independent motion, but still borrows its clock; see [Clocks](timing-options.md#clocks). | `morph/attachMorph.ts` header |
| Content reflows as its box grows | A `<Part>` lays out once at its resting width; growth clips it instead of re-wrapping it. | `morph/pinParts.ts` |
| Repeated text can remain ordinary content in a container Morph | The container ghost paints departure glyphs over arrival glyphs. Pair repeated text as a nested Morph with `name="text"`. | `morph/attachMorph.ts` (`paired descendant`, `NESTED`) |
| Text Morphs can inherit typography and remain inline | The runtime can compute travel while a non-replaced inline line box stays at its destination. Put typography on a transformable Morph box and preserve surrounding space in a holder. | `Morph.tsx`, `morph/attachMorph.ts` (`WHERE THE FLIGHT BEGINS`) |
| Different copy at each end is also a Morph | A Morph asserts one identity. Keep the continuously shared item as a Morph; hand different eyebrow, summary, or controls over as Parts beside it. | `morph/attachMorph.ts`, `transition/partTransition/createPartTransition.ts` |
| Each participant owns timing | Parts, decorators, and morphs inherit the flight's clock by variant key. | [Clocks](timing-options.md#clocks) |

## Who is who on every status

`data-flemo-active` follows the stack, not travel direction. Select pose slots using this table.

| status | active | Screen role | Screen slot | Morph slot | Part slot | Decorator slot |
| --- | --- | --- | --- | --- | --- | --- |
| PUSHING | true | arriving, new top | `enter` | `enter`, flies | `idle` | `idle` |
| PUSHING | false | covered, going behind | `exit` | `exit`, cut | `enter` | `enter` |
| REPLACING | true | arriving | `enter` | `enter`, flies | `idle` | `idle` |
| REPLACING | false | leaving | `exit` | `exit`, cut | `enter` | `enter` |
| POPPING | true | being dismissed, still top | `enterBack` | `exit`, cut | `dismiss`, else `idle` | `idle` |
| POPPING | false | returning, underneath | `exitBack` | `enter`, flies | `exit` | `exit` |
| COMPLETED | true | settled active | `enter` | `idle` | `idle` | `idle` |
| COMPLETED | false | settled behind | `exit` | `idle` | `enter` | `enter` |

- `enterBack` is the active screen leaving on pop. In `cupertino`, it is `x: "100%"`.
- Interpreting `active === "true"` as arrival pairs morphs backwards on every pop.

## Factory vocabulary

The four factories share slot names with different meanings. Check the factory before reusing a pose.

| Property | `createTransition` | `createMorphTransition` | `createPartTransition` | `createDecorator` |
| --- | --- | --- | --- | --- |
| Animates | screen itself | two elements sharing a `layoutId` | one named element, screen chrome | wash or dim over a screen |
| Reached through | the Router's `defaultTransitionName`, or a navigation's `transitionName` | `<Morph name>` | `<Part name>`, by name, under any transition | only a transition's `decoratorName` |
| Clock | authored; source clock | its `enter`, else screen's | carrying screen, resolved per transition | naming transition, resolved once |
| `idle` | at rest | at rest; departure's start pose | at rest | at rest; invisible for an overlay |
| `enter` | active screen arriving | arriving side, which flies | screen entering background, PUSHING-false | screen entering background, PUSHING-false |
| `exit` | covered screen leaving | departing side, which is cut | screen returning, POPPING-false | screen returning, POPPING-false |
| `enterBack` | active screen leaving on pop | not a slot | not a slot | not a slot |
| `exitBack` | covered screen returning | not a slot | not a slot | not a slot |
| `dismiss` | not a slot | not a slot | screen being popped off, POPPING-true; omission holds `idle` | not a slot; holds `idle` there |
| `initial` | pre-mount pose; FROM of `enter` | arriving element's start, on top of what it replaces | FROM of PUSHING-true and REPLACING-true | FROM of PUSHING-true and REPLACING-true |

Applying screen slot meanings to a part or decorator animates the wrong side and can appear to fade only one way.

Parts and decorators differ in one slot and how they are reached. Without `dismiss`, `idle` / `enter` / `exit` fade the returning part in on pop while the dismissed part stays fully opaque; the previous workaround required restating all ten variants through `createRawPartTransition`. A decorator has no `dismiss`: it dresses one transition, and the dismissed screen is not the screen it dresses.

Both parts and decorators animate from the previous variant's pose, not `initial`. POPPING-false starts where PUSHING-false settled (`FROM_VARIANT`); match `exit` to `idle` to land without a snap.
