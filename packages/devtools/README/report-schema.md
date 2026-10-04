# Report schema v4

A report contains:

- `generatedAt`, `version: "4"` and `verdict`: the session described in sentences, most important first.
- `preconditions[]`: the judging protocol checks a page can observe, each `ok`, `violated` or `unknown`, with the reasoning and numbers. Conditions a page cannot observe stay `unknown`.
- `environment`: user agent and brands, engine, platform, touch points, device pixel ratio, hardware concurrency, screen and viewport sizes, visual viewport scale, the idle `rafCadence`, reduced motion, development-server globals, whether emulation is suspected, and what the recorder could observe: long tasks, element animations, and whether its own animation channel ever fired.
- `overrides.active`: every `flemo:*` key in both storages, unknown keys, keys cleared since the recorder attached, and retired keys marked inert. Since 2026-08-31 flemo reads no `flemo:*` engine key; `overrides.warnings` explains each leftover key.
- `transitions[]`: one entry per recorded transition, with its id, Router, bucket, navigation kind, timestamps, duration, detected driver, the elements that moved, holds, frame and phase statistics, motion, images, shared elements, tripwires, what drove it, long tasks, the checks run after it ended (`endAudit`), and stable anomaly messages. Each entry is a `TransitionRecord`.
- `comparison[]`: medians, worst gaps, dropped frames, anomalies and stalls per bucket; empty until `mark()` sets a label.
- `previousSession`: transitions carried over from before the last full page load, kept apart from the live ones.
- Session `anomalies`, the constant `blindSpots` and the constant `judgingProtocol`.

Each transition's `driver` is `compiled`, `inline`, `mixed` or `unknown`; never infer it from the platform. flemo compiles every animation, so `inline` means something else is writing styles onto an element that moves.

`holds.releasedAtMs` is the last time the hold was released, relative to `t0`. Work done while a transition is held is absorbed on purpose: frame gaps and long tasks are split into held and released phases, and gaps while held raise no anomaly.

See [What is measured](transition-measurements.md) for motion, shared elements, tripwires, input, images and the checks after a transition ends.
