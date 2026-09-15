# Diagnostics and completion

## Symptom to cause

Check this table before instrumenting.

| Symptom | Cause or correction | Source |
| --- | --- | --- |
| Morphed element flickers after pop settles | Morph `exit` does not end at `opacity: 0`, so the cut never hides it. | `utils/devWarn.ts` `warnDepartureNotHidden` |
| Second card copy appears beside flight for one frame | Cut was authored over a window instead of from frame one. | `morph/attachMorph.ts` |
| Wholly blank frame at hand-over | An arrival held at opacity 0 has no raster to promote; hold it at 0.006 instead. | `morph/attachMorph.ts` `HELD_OPACITY` |
| Text doubles or blurs mid-flight inside a container Morph | Ordinary text on both ends lets departure ghost glyphs fade over arrival glyphs. Pair text as a nested `name="text"` Morph. | `morph/attachMorph.ts` |
| Text changes size but appears at destination before travelling | A non-replaced inline Morph's computed translate does not move its line box. Use `display: block` or `inline-block`, put font size and line height on the Morph, and retain layout space in a holder. | `Morph.tsx`, `morph/attachMorph.ts` |
| Container flight displays old and new copy together | Copy with different identities was left to the ghost and arrival. Keep the shared item as a nested Morph, hand changing copy over with a sibling Part, and do not fade the shared Morph's parent. | `morph/attachMorph.ts`, `transition/partTransition/createPartTransition.ts` |
| Body copy repeatedly re-wraps, then jumps | A `<Part>` was laid out at intermediate box widths. | `morph/pinParts.ts` |
| Part narrower than its carrying box | Part was pinned at its staging width, which was the cell's. | `morph/pinParts.ts`; devtools anomaly "narrower than the box" |
| Part snaps while screen takes 0.7s | Part omitted duration and has no screen to inherit from. | `transition/partTransition/resolvePartClock.ts` |
| Part travels a different visible distance at the same screen position on automatic pop and swipe | Part inherited duration but uses different easing. Swipe is spatially scrubbed; automatic pop is time-driven. Give participating Part variants the screen's easing. | [Clocks](timing-options.md#clocks) |
| Authored slide disappears under zoom | `carry: "screen"` supersedes it. | `utils/devWarn.ts` `warnCameraOverridesScreen` |
| Swipe back looks different from the pop it walks | Seeking a rider through its own curve cancels that curve, so the drag shows a phase the flight never runs. | `core/engine/riderSwipe.ts` `scrub` |
| Shared element paints over the header, tab bar, or dim while flying | The flight layer sits above every screen container, and a scope's own content cannot outrank it. | [Motion semantics](semantics.md#what-flemo-does-differently) |
| Morph pairs backwards only on pops | `active` was interpreted as travel direction. | [Status slots](semantics.md#who-is-who-on-every-status) |
| Correctly spelled name animates nothing | Nothing registered under that name; lookup was total and silent before the warning. | `utils/devWarn.ts` `warnUnregistered` |
| Header or provider inside `<Router>` is ignored | Without `<Slot>`, children are the routes. | `react/src/Router.tsx` |
| Nested Router's shared element flies outside its box | The flight layer fell back to document level; a binding must publish the scope's layer. | `morph/morphLayer.ts` |
| First push runs element 33ms ahead of screen; later pushes align | Head kit read from root attribute instead of routing. | `morph/morphSide.ts` `headSeconds` |
| Curve differs from authored easing | An easing string unknown to flemo and CSS resolved to `ease`. | `transition/easing.ts` |

## Before calling it done

- [ ] Check every pose against the [status-slot table](semantics.md#who-is-who-on-every-status) on both POP and PUSH.
- [ ] No participant restates a duration another owns. If a literal duration appears twice, one is already wrong.
- [ ] Morph `exit` ends hidden.
- [ ] Repeated text inside a container Morph has a nested `name="text"` identity, avoiding glyphs painted by both ghost and arrival.
- [ ] Every text Morph is a transformable box that owns its typography, with a stable holder wherever temporary removal would collapse layout.
- [ ] Copy that changes identity uses a sibling Part; that Part does not wrap a continuously visible nested Morph.
- [ ] A camera is paired with a still screen transition.
- [ ] Content that must not re-wrap is a `<Part>`, typeset at its landing width.
- [ ] Routes live in a `<Slot>` whenever anything else lives in the Router.
- [ ] Every navigation names its intended Router owner, including nested-stack pushes and cross-Router pops.
- [ ] A Part uses `onSwipe*` only when its gesture shape intentionally differs from its declared pop; both commit and cancellation are handled.
- [ ] Reproduce once with `@flemo/devtools` attached; `window.flemo.report()` shows no anomalies. See `docs/instructions/diagnostics.md`.
- [ ] Development console is clean. Each warning in `utils/devWarn.ts` fires once for a genuine problem.
