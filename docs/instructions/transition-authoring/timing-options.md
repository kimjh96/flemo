# Clocks and options

## Clocks

Do not hand-write a duration owned by another participant; duplicated literals drift.

| Participant | Duration | Delay | Ease |
| --- | --- | --- | --- |
| Screen transition | Authored; source clock | Authored | Authored |
| Morph | Its `enter` variant's own, else the screen's, else 0.4s when the screen has none (`none`) | n/a | Its own, except when the screen moves; then the screen's, because the destination rides that screen |
| Part | Authored, else the screen's same variant key | Authored, else the screen's; `after: "flight"` means screen delay plus duration | Authored only; never inherited |
| Decorator | Authored, else the screen's same variant key | Authored, else the screen's | Authored only; never inherited |

- Inheritance uses the same variant key. Asymmetric presets give parts and dim the same asymmetry: `material` runs 0.35s pushing and 0.25s popping.
- Equal duration does not guarantee equal spatial phase. Programmatic flights evaluate each participant's easing over time; swipes seek every rider to the finger's spatial progress. If a Part must occupy the same fraction of its path at the same screen position in both interactions, give it the screen's easing and duration.
- Use `??`, not `||`: an authored `0` requests a snap and must survive resolution.
- A part longer than its screen holds the whole flight open and disables swipe-back for as long as it runs.
- Resolve timing at compile time to a literal. Never pass `var()` to `animation-duration`: this lost WebKit accelerated playback and caused a two-frame snap under main-thread starvation (device-bisected 2026-08-13).
- Use `after: "flight"` for chrome revealed at landing when it does not know the flight's length. This replaces per-transition part tables that could not include a consumer's own transition.

## Options

| Option | Default | Runtime meaning | Failure or caveat |
| --- | --- | --- | --- |
| morph `exit` end pose | Presets all end at `opacity: 0` | Cut pose holding the departure for the entire flight | A visible end pose keeps the departure painting: covered on push, revealed on pop. |
| `crossFade` | 0.55 | Fraction of the flight over which the ghost, a copy of what was on glass, dissolves | `0` cuts to arrival content on frame one; content without a counterpart appears clipped rather than leaving. |
| `radius` | true | Interpolates `border-radius` through the flight on the content animation | Putting radius on the geometry keyframe drops it off the compositor. |
| `carry: "screen"` | off | Camera scales and translates the screen where the element is small by exactly the element's zoom | With a moving screen transition, the camera supersedes screen motion and discards authored travel. |
| `swipe: { direction }` | none | Walks the transition's own POPPING pair at the finger | Hand-written per-frame style writes recreate what this declarative form replaced. |
| Part `onSwipe*` callbacks | none | Without callbacks, declared POPPING variants automatically follow gesture progress and the resolved clock; any callback opts that Part out | Hooks added merely to enable tracking replace working declarative tracking with incomplete custom control. |
| `decoratorName` | none | Dims or washes the flight on its clock | A decorator's own literal clock can outlive its screen, causing an unexplained lifting grey cast. |
| easing | `ease` | Named eases, CSS keywords, `cubic-bezier()`, `steps()`, `linear()`, or a four-number tuple | An unknown string compiles to `ease` and warns once in development. |
