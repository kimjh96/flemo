# @flemo/devtools

A zero-dependency transition recorder, on-device readout and visual panel for [flemo](https://flemo.dev), with a one-element React binding. It records every screen transition, checks it for known defects, and writes one JSON report that people and coding agents can read.

It reads only what the page already exposes: the `data-flemo-*` attributes, leftover `flemo:*` storage keys, CSS animation events, pointer events, `MutationObserver`, `PerformanceObserver("longtask")` and `requestAnimationFrame`. It imports neither `@flemo/core` nor `@flemo/react`, so attaching it does not change the motion it measures.

Start recording with `attachTransitionRecorder`. Each recorded transition is a `TransitionRecord` in `report().transitions`, and `maxTransitions` sets how many are kept. Its checks after the transition ends are in `endAudit`, and the shared elements that moved are in `morphs.moved`.

Each question has its own probe module: frame pacing, motion, images, shared elements, one-frame events, and what is left behind after a transition ends. Adding a measurement means adding a probe.

- [Quickstart: React and any framework](README/quickstart.md)
- [Production safety](README/production-safety.md)
- [On-device readout](README/readout.md)
- [Visual panel](README/panel.md)
- [Report schema v4](README/report-schema.md)
- [What is measured](README/transition-measurements.md)
- [Detected defects](README/defects.md)
- [Judging protocol, blind spots, and sharing reports](README/judging.md)
- [API](README/api.md)
