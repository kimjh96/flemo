# @flemo/devtools

Zero-dependency flight recorder, on-device readout and visual panel for [flemo](https://flemo.dev) transitions, with a one-element React binding. It observes existing `data-flemo-*` surfaces, leftover `flemo:*` keys, CSS animation events, pointer events, `MutationObserver`, `PerformanceObserver("longtask")`, and rAF. It imports neither `@flemo/core` nor `@flemo/react` and does not alter measured motion.

A small orchestrator runs one probe module per question: pacing, motion, images, shared elements, one-frame events, and landing residue. Add a probe to add a measurement.

- [Quickstart: React and any framework](README/quickstart.md)
- [Production safety](README/production-safety.md)
- [On-device readout](README/readout.md)
- [Visual panel](README/panel.md)
- [Report schema v3](README/report-schema.md)
- [Flight measurements](README/flight-measurements.md)
- [Detected defects](README/defects.md)
- [Judging protocol, blind spots, and sharing reports](README/judging.md)
- [API](README/api.md)
