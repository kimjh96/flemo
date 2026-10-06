# @flemo/devtools

A zero-dependency transition recorder, on-device readout, and visual panel for [flemo](https://flemo.dev), with a one-element React binding. It records every screen transition, checks for known defects, and writes one JSON report for people and coding agents.

It reads only page-exposed `data-flemo-*` attributes, leftover `flemo:*` storage keys, CSS animation events, pointer events, `MutationObserver`, `PerformanceObserver("longtask")`, and `requestAnimationFrame`. It imports neither `@flemo/core` nor `@flemo/react`; attaching it does not change the motion measured.

Start with `attachTransitionRecorder`. Each transition is a `TransitionRecord` in `report().transitions`; `maxTransitions` limits retention. Post-transition checks are in `endAudit`, and moved shared elements are in `morphs.moved`.

Separate probe modules cover frame pacing, motion, images, shared elements, one-frame events, and leftovers after transitions. Add a probe to add a measurement.

- [Quickstart: React and any framework](README/quickstart.md)
- [Production safety](README/production-safety.md)
- [On-device readout](README/readout.md)
- [Visual panel](README/panel.md)
- [Report schema v4](README/report-schema.md)
- [What is measured](README/transition-measurements.md)
- [Detected defects](README/defects.md)
- [Judging protocol, blind spots, and sharing reports](README/judging.md)
- [API](README/api.md)
