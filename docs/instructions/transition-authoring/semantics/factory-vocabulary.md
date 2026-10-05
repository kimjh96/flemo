# Factory vocabulary

The four factories share slot names with different meanings. Check the factory before reusing a pose.

| Property | `createTransition` | `createMorphTransition` | `createPartTransition` | `createDecorator` |
| --- | --- | --- | --- | --- |
| Animates | screen itself | two elements sharing a `layoutId` | one named element, screen chrome | wash or dim over a screen |
| Reached through | the Router's `defaultTransitionName`, or a navigation's `transitionName` | `<Morph name>` | `<Part name>`, by name, under any transition | only a transition's `decoratorName` |
| Clock | authored; source clock | its `enter`, else screen's | carrying screen, resolved per transition | naming transition, resolved once |
| `idle` | at rest | at rest; departure's start pose | at rest | at rest; invisible for an overlay |
| `enter` | active screen arriving | arriving side, which moves | screen entering background, PUSHING-false | screen entering background, PUSHING-false |
| `exit` | covered screen leaving | departing side, which is cut | screen returning, POPPING-false | screen returning, POPPING-false |
| `enterBack` | active screen leaving on pop | not a slot | not a slot | not a slot |
| `exitBack` | covered screen returning | not a slot | not a slot | not a slot |
| `dismiss` | not a slot | not a slot | screen being popped off, POPPING-true; omission holds `idle` | not a slot; holds `idle` there |
| `initial` | pre-mount pose; FROM of `enter` | arriving element's start, on top of what it replaces | FROM of PUSHING-true and REPLACING-true | FROM of PUSHING-true and REPLACING-true |

Applying screen slot meanings to a part or decorator animates the wrong side and can appear to fade only one way.

Parts and decorators differ in one slot and in how they are reached. Without `dismiss`, `idle` / `enter` / `exit` fade the returning part in on pop while the dismissed part stays fully opaque. The previous workaround required restating all ten variants through `createRawPartTransition`.

A decorator has no `dismiss`: it dresses one transition, and the dismissed screen is not the screen it dresses.

Both parts and decorators animate from the previous variant's pose, not `initial`. POPPING-false starts where PUSHING-false settled (`FROM_VARIANT`); match `exit` to `idle` to land without a snap.
