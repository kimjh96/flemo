# Report schema v4

A report contains:

- `generatedAt`, `version: "4"`, and `verdict`: sentences describing the session, most important first.
- `preconditions[]`: judging protocol checks observable by a page, each `ok`, `violated`, or `unknown`, with reasoning and numbers. Conditions a page cannot observe remain `unknown`.
- `environment`: user agent and brands, engine, platform, touch points, device pixel ratio, hardware concurrency, screen and viewport sizes, visual viewport scale, idle `rafCadence`, reduced motion, development-server globals, suspected emulation, and recorder observability: long tasks, element animations, and whether its own animation channel ever fired.
- `overrides.active`: every `flemo:*` key in both storages, unknown keys, keys cleared since recorder attachment, and retired keys marked inert. Since 2026-08-31, flemo reads no `flemo:*` engine key; `overrides.warnings` explains each leftover key.
- `transitions[]`: one `TransitionRecord` per recorded transition, containing its id, Router, bucket, navigation kind, timestamps, duration, detected driver, moving elements, holds, frame and phase statistics, motion, images, shared elements, tripwires, what drove it, long tasks, post-transition checks (`endAudit`), and stable anomaly messages.
- `comparison[]`: medians, worst gaps, dropped frames, anomalies, and stalls per bucket; empty until `mark()` sets a label.
- `previousSession`: transitions carried over from before the last full page load, separate from live transitions.
- Session `anomalies`, constant `blindSpots`, and constant `judgingProtocol`.

Each transition's `driver` is `compiled`, `inline`, `mixed`, or `unknown`. Never infer it from the platform. flemo compiles every animation; `inline` means something else writes styles onto a moving element.

`holds.releasedAtMs` is the last hold release time relative to `t0`. Work during a hold is intentionally absorbed: frame gaps and long tasks are split into held and released phases, and held-phase gaps raise no anomaly.

See [What is measured](transition-measurements.md) for motion, shared elements, tripwires, input, images, and post-transition checks.
