---
name: flemo
description: Design, implement, review, or debug flemo navigation and motion with @flemo/react. Use for Router, Route, Screen, Slot, useNavigate, nested or named Router ownership, transitions and raw factories, Part and shared bars, Morph and layoutId, decorators, Layer, swipe gestures, or @flemo/devtools, especially when composing app chrome across screen changes.
---

# Flemo

Design navigation topology, visual ownership, and motion together. A locally plausible animation can be globally wrong when assigned to the wrong Router or screen side.

## Establish the source of truth

1. Inspect the installed `@flemo/react` version, public exports, and declaration JSDoc before assuming an API exists.
2. In the flemo repository, follow root instructions and required authoring documents. In consumer repositories, do not depend on flemo's private source paths.
3. Use this skill's references for the durable mental model and website or full-text documentation for API breadth and examples.

## Choose the working path

- Isolated pose or timing edit with established Router owner, screen sides, and primitive: read [motion-authoring.md](references/motion-authoring.md), then edit directly.
- New navigation, nested routing, shared chrome, or composition with three or more participants: read [routing-and-ownership.md](references/routing-and-ownership.md), then [composition.md](references/composition.md), then [motion-authoring.md](references/motion-authoring.md).
- Defect: read the relevant model above and [verification.md](references/verification.md). Diagnose before changing motion.

## Build from topology to poses

1. Draw each Router as a node with its `name`, history mode, owned route paths, parent, and `Slot` boundary.
2. Resolve each navigation from its calling component. Record the target Router and operation: push, replace, or pop.
3. Before coding, make a participant matrix:

| Participant | Router owner | Primitive | Identity | Push role | Pop role | Swipe owner | Clock owner | Paint layer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Example: header title | app | Part in shared top bar | part name + shared bar ID | old out, new in | top out, previous in | default Part rider | app screen | part layer |

4. Choose primitives by ownership and identity, not desired easing:
   - `Slot`: literally persistent layout around one Router's moving region.
   - Matching shared bars: per-screen chrome whose shell appears continuous.
   - `Part`: an independently moving element within that screen or shared chrome.
   - `Morph`: one visual object represented on both screens with the same `layoutId`.
   - Decorator: a wash or dim tied to a transition.
   - `Layer`: content that must paint over screen chrome.
5. Author named transitions and register them on the Router owning the flight. Add type registries when the project uses them.
6. Verify push and pop, plus swipe completion and cancellation. Push alone is insufficient.

## Preserve invariants

- `active` follows the stack: during pop, the dismissing top screen remains active and the returning screen underneath is inactive.
- A pose-only Part follows swipe progress and inherits its carrying screen's matching variant clock. Any `onSwipe*` callback opts that Part out of the default rider and assumes full control.
- Missing Part duration and delay inherit by matching variant. Explicit zero remains zero; easing never inherits.
- A Morph flies the arriving element and cuts the departing element at its `exit` end-pose. Pop reverses which active flag denotes arrival.
- Router names resolve through the current Router and its ancestors, never siblings. A pathless cross-Router pop must name its owner.
- Do not repeat durations owned by another participant; repeated literals drift.

## Finish with evidence

Run the project's typecheck, lint, tests, and production build, then follow [verification.md](references/verification.md). Automated checks establish state and cleanup; the human reviewer decides whether motion reads correctly on a real device.
