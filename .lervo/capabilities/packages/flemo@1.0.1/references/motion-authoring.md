# Motion authoring

## Screen sides

`active` means stack position, not travel direction.

| Status    | active | Screen role               | Compact screen slot | Part slot              | Morph side     | Decorator slot |
| --------- | ------ | ------------------------- | ------------------- | ---------------------- | -------------- | -------------- |
| PUSHING   | true   | arriving new top          | `enter`             | `idle`                 | `enter`, flies | `idle`         |
| PUSHING   | false  | covered, moving behind    | `exit`              | `enter`                | `exit`, cut    | `enter`        |
| REPLACING | true   | arriving replacement      | `enter`             | `idle`                 | `enter`, flies | `idle`         |
| REPLACING | false  | leaving                   | `exit`              | `enter`                | `exit`, cut    | `enter`        |
| POPPING   | true   | top being dismissed       | `enterBack`         | `dismiss`, else `idle` | `exit`, cut    | `idle`         |
| POPPING   | false  | previous screen returning | `exitBack`          | `exit`                 | `enter`, flies | `exit`         |

Use `createTransition`, `createPartTransition`, `createMorphTransition`, and `createDecorator` when these compact roles fit. Use the matching raw factory when push, replace, pop, or completed states need distinct targets. Raw names describe operation and side; confirm exact status mappings in declaration JSDoc rather than inferring them from `Enter` or `Exit`.

## Clock ownership

| Participant | Duration                                       | Delay                                                                             | Easing                                               |
| ----------- | ---------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Screen      | authored source                                | authored source                                                                   | authored source                                      |
| Part        | own value, else carrying screen's same variant | own value, else screen; `after: "flight"` waits through screen delay and duration | own only                                             |
| Decorator   | own value, else naming screen's same variant   | own value, else screen                                                            | own only                                             |
| Morph       | arriving `enter`, else screen, else 0.4s       | no separate delay contract                                                        | own, except screen-carrying motion uses screen curve |

Explicit `0` remains zero. A Part longer than its Screen delays completion and the next swipe-back. Do not copy screen durations into Parts or decorators merely to synchronize them.

Clock inheritance does not spatially phase-align a Part with its Screen if their easings differ. Programmatic flight evaluates each easing over time; swiping seeks every rider to the finger's spatial progress. To keep a Part at the same fraction of its path for the same Screen position in both interactions, use the same easing on the Screen and every participating Part variant.

## Part gesture behavior

A Part without `onSwipeStart`, `onSwipe`, or `onSwipeEnd` still participates in gestures. During interactive pop, flemo resolves its `POPPING-${active}` definition, stages previous and target poses, scrubs with the same gesture progress, and settles on commit or cancellation.

Adding any Part swipe callback disables that default rider for the whole Part definition on both screen sides. Custom callbacks must provide every intended drag pose and both landing outcomes. Use them only for a gesture-specific shape, such as opacity finishing at 55% while translation continues through 100%.

## Morph behavior

- Two `Morph` elements pair by `layoutId` within one Router flight boundary.
- The arriving element flies between measured boxes; the departing element is pinned at the end of its `exit` pose from frame one.
- End `exit` hidden for the usual cut. A visible departure can be covered on push and unexpectedly revealed behind a shrinking element on pop.
- A Morph animates its box, allowing children to reflow. A nested `Part` is laid out once at its resting width when content must clip instead of re-wrap.
- When identical text appears at both ends of a container Morph, pair it as a nested Morph with `name="text"`. Otherwise the container ghost fades departure glyphs over arrival glyphs, doubling the letters.
- Put font size and line height on the text Morph itself. Make its rendered element transformable with `display: block` or `inline-block`: computed translate does not move a non-replaced inline line box. Keep a holder when surrounding layout must retain the line's resting space during flight.
- `carry: "screen"` is camera behavior that supersedes authored motion on the carried screen; pair it with a still screen transition.

## Decorator and Layer

A decorator belongs to the inactive side of the screen transition that names it. Omit duration and delay to inherit the flight clock; choose easing independently.

Use `Layer` for sheets, menus, or overlays that must paint above shared bars. It targets the outer screen's layer host, so fixed placement in a nested Router is relative to that host, not automatically the nested box. Use ordinary absolute content when the overlay should remain clipped to the nested Slot.
