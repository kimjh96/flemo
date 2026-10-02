# Verification

Automation proves invariants. A person decides whether motion communicates the intended spatial and visual relationship.

## Required matrix

Exercise each applicable row in both directions.

| Area             | Cases                                                                            | Observe                                                                         |
| ---------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Router ownership | single, nested, sibling, duplicate names                                         | only the intended stack changes; invalid targets warn or fail in development    |
| Navigation       | push, replace, programmatic pop, browser back                                    | correct route, history index, and transition on both screen sides               |
| Gesture          | slow partial drag, cancel, threshold commit, velocity commit, reversal           | screen, Part, Morph, and decorator remain phase-aligned and land without a snap |
| Shared chrome    | matching and mismatched bar IDs, different title lengths, missing action         | correct handoff, stable shell geometry, no duplicate or stale content           |
| Timing           | inherited, asymmetric, explicit zero, `after: "flight"`, Part longer than Screen | documented clock wins; completion waits for the longest participant             |
| Morph            | push and pop, clipped content, changing radius, unmatched and duplicate IDs      | correct arriving side flies, departure is hidden, layout and cleanup are stable |
| Paint            | Slot clipping, shared bars, Layer, nested Router box                             | intended z-order and containing block on every frame                            |

## Automated checks

1. Run the consumer project's typecheck, lint, tests, and production build.
2. Assert the intended Router's history changes while unrelated Router histories remain unchanged.
3. Assert navigation reaches `COMPLETED` after commit and cancellation.
4. Assert no flight roles, stand-ins, inline transforms, holds, or transitional statuses remain at rest.
5. If `@flemo/devtools` is available in development, reproduce once and inspect `window.flemo.report()`. Read `verdict`, `preconditions`, flight anomalies, then blind spots.

The recorder provides evidence about runtime state and pacing; it does not replace visual judgment. Do not introduce an MCP server merely to deliver static docs. A future live MCP integration is useful only if it exposes recorder state or controlled runtime actions unavailable from files.

## Human visual review

Review on a real target device with DevTools and capture closed. Record display refresh rate, scaling, reduced motion, and power mode. Use real touch for gesture paths.

Watch first without overlays:

- Does motion explain which region or stack changed?
- Does the header shell remain optically fixed while title and actions trade places?
- During a slow swipe, do all visible participants stay attached to the finger?
- On cancellation, does every participant return along a coherent path?
- On commit, is there any one-frame duplicate, blank, jump, re-wrap, or z-order inversion?
- Are long and short titles aligned at rest and legible during handoff?

After visual judgment, inspect the recorder report. A clean report does not overrule visible jank; it narrows the remaining cause to compositor, presentation, display, or an unobserved visual rule.

## Portable skill evaluation

Before treating a revised skill as proven, give multiple unfamiliar agents the same fixture and prompt, once with only public types/docs and once with this skill. Do not let them inspect flemo source. Score outputs without knowing which condition produced them.

Use a task requiring:

- a root Router and nested memory Router;
- local and ancestor-targeted navigation;
- a shared header whose title and left action animate on push, pop, swipe, and cancellation;
- one root-owned Morph and one overlay above chrome;
- no Part swipe hooks unless the proposed gesture shape differs from programmatic pop.

Score Router ownership, Slot placement, screen-side mapping, clock duplication, Part rider correctness, Morph scope, Layer placement, and verification coverage. Split into narrower skills only if repeated trials reduce selection cost without increasing ownership mistakes.
