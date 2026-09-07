# Authoring a flemo transition

Read this before writing a `createTransition`, `createMorphTransition`, `createPartTransition`, or `createDecorator`, and before wiring a `<Slot>`, a `<Part>`, or a `<Morph>`.

Every row here is a rule the runtime already enforces. The reason each one is written down is that breaking it produces working code: the types pass, the DOM is correct, the console is silent, and the motion is wrong. This file is tables on purpose. The narrative for each rule is in the source comment named in the last column.

## 1. What flemo does differently

Prior experience with shared-element libraries is the largest single source of wrong first drafts, because flemo inverts most of it.

| Expectation from elsewhere | What flemo does | Where |
| --- | --- | --- |
| The element is moved and scaled | Its BOX is animated so the subtree lays out at every size on the way | `morph/morphKeyframes.ts` |
| Both ends cross-fade | The departure is CUT, pinned at its `exit` end pose from the flight's first frame | `morph/attachMorph.ts` (`CUT FROM THE FIRST FRAME`) |
| The departing element flies | The ARRIVING one flies, and on a pop that is the element on the screen being returned to | `morph/attachMorph.ts` (`arrivingActive`) |
| `active` means "the screen coming in" | `active` follows the STACK: on a pop the dismissing screen is still the top one and stays `true` | `transition/morphTransition/createMorphTransition.ts` |
| The element animates in place | It leaves its screen for the flight layer, because a screen clips, covers, and drags its descendants | `morph/morphLayer.ts` |
| A shared element inherits the screen's transition | A morph is independent of its MOTION, having left the screen; it still borrows its CLOCK, see section 4 | `morph/attachMorph.ts` header |
| Content reflows as the box grows | A `<Part>` is laid out ONCE at its resting width; the growth clips it rather than re-wrapping it | `morph/pinParts.ts` |
| Timing is per participant | Parts, decorators, and morphs inherit the flight's clock by variant key | section 4 |

## 2. Who is who, on every status

`data-flemo-active` follows the stack, not the direction of travel. Read this table before deciding which slot a pose belongs in.

| status | active | The screen | Screen slot | Morph slot | Part slot | Decorator slot |
| --- | --- | --- | --- | --- | --- | --- |
| PUSHING | true | arriving, new top | `enter` | `enter`, and it FLIES | `idle` | `idle` |
| PUSHING | false | covered, going behind | `exit` | `exit`, and it is CUT | `enter` | `enter` |
| REPLACING | true | arriving | `enter` | `enter`, flies | `idle` | `idle` |
| REPLACING | false | leaving | `exit` | `exit`, cut | `enter` | `enter` |
| POPPING | true | being dismissed, still top | `enterBack` | `exit`, cut | `dismiss`, else `idle` | `idle` |
| POPPING | false | returning, underneath | `exitBack` | `enter`, flies | `exit` | `exit` |
| COMPLETED | true | settled active | `enter` | `idle` | `idle` | `idle` |
| COMPLETED | false | settled behind | `exit` | `idle` | `enter` | `enter` |

Two consequences that cost a day each:

- `enterBack` is the ACTIVE screen leaving on a pop, not a screen entering. In `cupertino` it is `x: "100%"`.
- Reading `active === "true"` as "the arrival" pairs a morph backwards on every pop.

## 3. `enter` means three different things

The four factories share a vocabulary and do not share its meaning. Check the factory before reusing a pose.

| | `createTransition` | `createMorphTransition` | `createPartTransition` | `createDecorator` |
| --- | --- | --- | --- | --- |
| What it animates | the screen itself | the two elements sharing a `layoutId` | one named element, screen chrome | the wash or dim over a screen |
| How it is reached | `<Route transition>` and the Router's table | `<Morph name>` | `<Part name>`, by name, under ANY transition | only through a transition's `decoratorName` |
| Clock | authored, it is the source | its `enter`, else the screen's | the screen carrying it, resolved per transition | the transition that names it, resolved once |
| `idle` | at rest | at rest, and the departure's start pose | at rest | at rest, which for an overlay is invisible |
| `enter` | the active screen ARRIVING | the ARRIVING SIDE, the one that flies | the screen going INTO the background, PUSHING-false | the screen going INTO the background, PUSHING-false |
| `exit` | the covered screen leaving | the DEPARTING SIDE, which is cut | the screen coming BACK, POPPING-false | the screen coming BACK, POPPING-false |
| `enterBack` | the active screen leaving on a pop | not a slot | not a slot | not a slot |
| `exitBack` | the covered screen returning | not a slot | not a slot | not a slot |
| `dismiss` | not a slot | not a slot | the screen being popped off, POPPING-true; omitting it holds `idle` | NOT A SLOT: a decorator holds `idle` there |
| `initial` | pre-mount pose, the FROM of `enter` | where the ARRIVING element starts, on top of what it replaces | the FROM of PUSHING-true and REPLACING-true | the FROM of PUSHING-true and REPLACING-true |

A part or decorator authored with a screen's mental model animates on the wrong side and looks like it "only fades one way".

A part and a decorator differ in exactly one slot and in how they are reached. `dismiss` is why: with only `idle` / `enter` / `exit`, a pop faded the returning part in while the one being dismissed sat at full opacity, and the only way out was to restate all ten variants through `createRawPartTransition`. A decorator has no such slot because it dresses ONE transition and the screen being dismissed is not the one it is dressing.

Both animate from the previous variant's pose, not from `initial`: POPPING-false starts where PUSHING-false settled (`FROM_VARIANT`), so matching `exit` to `idle` is what lands them without a snap.

## 4. Clocks are inherited, not restated

Never hand-write a length that another participant already decides. Every such literal in this repository's history drifted.

| Participant | duration | delay | ease |
| --- | --- | --- | --- |
| Screen transition | authored, it is the source | authored | authored |
| Morph | its `enter` variant's own, else the screen's, else 0.4s when the screen has none (`none`) | n/a | its own, EXCEPT when the screen moves: then the screen's, because the destination is riding that screen |
| Part | authored, else the screen's SAME VARIANT KEY | authored, else the screen's; `after: "flight"` means the screen's delay plus its duration | authored only, never inherited |
| Decorator | authored, else the screen's same variant key | authored, else the screen's | authored only, never inherited |

- Inheritance is by the same variant key, so an asymmetric preset (`material` runs 0.35s pushing and 0.25s popping) gives its parts and its dim the same asymmetry for free.
- `??`, not `||`: an authored `0` is a snap the author asked for and survives.
- A part authored LONGER than its screen holds the whole flight open, which disables swipe-back for as long as it runs.
- Resolution is compile time and produces a literal. Timing must never reach `animation-duration` as a `var()`: that lost WebKit's accelerated playback and collapsed to a two-frame snap under main-thread starvation (device-bisected 2026-08-13).
- `after: "flight"` is how a piece of chrome revealed at the landing waits for a flight whose length it does not know. It replaces the per-transition part tables that a consumer's own transition could never appear in.

## 5. Options, and what each one is really saying

| Option | Default | What it means at runtime | Break it and you get |
| --- | --- | --- | --- |
| morph `exit` end pose | presets all end at `opacity: 0` | the CUT the departure is pinned at for the whole flight | the element you are flying away from keeps painting: covered on a push, revealed on a pop |
| `crossFade` | 0.55 | the share of the flight over which the GHOST, a copy of what was on glass, dissolves | `0` cuts to the arrival's content on frame one, which reads as content with no counterpart being clipped rather than leaving |
| `radius` | true | interpolate `border-radius` across the flight, riding the CONTENT animation | a radius on the geometry keyframe drops it off the compositor |
| `carry: "screen"` | off | a camera: the screen the element is small on is scaled and translated by exactly the element's zoom | paired with a transition that moves the screen, the camera SUPERSEDES that motion and the authored travel is discarded |
| `swipe: { direction }` | none | the transition's own POPPING pair, walked at the finger | hand-written per-frame style writes, which is what the declarative form replaced |
| `decoratorName` | none | the dim or wash the flight dresses itself with, on the flight's clock | a decorator with its own literal clock outliving its screen, seen as a grey cast lifting for no reason |
| easing | `ease` | named eases, CSS keywords, `cubic-bezier()`, `steps()`, `linear()`, or a four-number tuple | an unknown string compiles to `ease` and warns once in development |

## 6. Symptom to cause

Search this table before instrumenting anything.

| What you see | Cause | Where |
| --- | --- | --- |
| A flicker of the morphed element after a pop settles | the morph's `exit` does not end at `opacity: 0`, so the cut never hides it | `utils/devWarn.ts` `warnDepartureNotHidden` |
| A second copy of the card beside the flight, one frame | a cut authored over a window instead of from frame one | `morph/attachMorph.ts` |
| One wholly blank frame at the hand-over | an arrival held at opacity 0 has no raster to promote; it is held at 0.006 instead | `morph/attachMorph.ts` `HELD_OPACITY` |
| Body copy re-wraps all the way up, then jumps | a `<Part>` laid out at the box's intermediate widths | `morph/pinParts.ts` |
| A part is narrower than the box carrying it | the part was pinned at its staging width, which was the cell's | `morph/pinParts.ts`, devtools anomaly "narrower than the box" |
| A part snaps while its screen takes 0.7s | an omitted duration on a part with no screen to inherit from | `transition/partTransition/resolvePartClock.ts` |
| An authored slide disappears under a zoom | `carry: "screen"` supersedes it | `utils/devWarn.ts` `warnCameraOverridesScreen` |
| The morph pairs backwards on pops only | `active` read as direction of travel | section 2 |
| The name is spelled right and nothing animates | nothing is registered under it; the lookup was total and silent before the warning | `utils/devWarn.ts` `warnUnregistered` |
| A header or provider inside `<Router>` is ignored | without a `<Slot>` the children ARE the routes | `react/src/Router.tsx` |
| A nested Router's shared element flies out of its box | the flight layer fell back to document level; a binding must publish the scope's layer | `morph/morphLayer.ts` |
| The first push runs the element 33ms ahead of its screen, later pushes align | the head kit read from the root attribute instead of the routing | `morph/morphSide.ts` `headSeconds` |
| The curve is not the one that was written | an easing string neither flemo nor CSS knows resolved to `ease` | `transition/easing.ts` |

## 7. Before calling it done

- [ ] Every pose is in the slot the table in section 2 gives it, checked on POP as well as PUSH.
- [ ] No participant restates a length another one owns. If a literal duration appears twice, one of them is wrong already.
- [ ] The morph's `exit` ends hidden.
- [ ] A camera is paired with a still screen transition.
- [ ] Content that must not re-wrap is a `<Part>`, and it is typeset at the width it lands at.
- [ ] Routes live in a `<Slot>` if anything else lives in the Router.
- [ ] Reproduced once with `@flemo/devtools` attached, and `window.flemo.report()` shows no anomalies (`docs/instructions/diagnostics.md`).
- [ ] The development console is clean. Every warning in `utils/devWarn.ts` fires once, for something that is genuinely wrong.
