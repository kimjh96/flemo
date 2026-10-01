# Report schema v3

Reports contain:

- `generatedAt`, `version: "3"`, and `verdict`: the session in sentences, most important first.
- `preconditions[]`: the observable judging protocol, each `ok`, `violated`, or `unknown`, with reasoning and numbers. Conditions a page cannot observe remain `unknown` permanently.
- `environment`: user agent and brands, engine, platform, touch count, DPR, hardware concurrency, screen and viewport sizes, visual viewport scale, idle `rafCadence`, reduced motion, development-server globals, emulation suspicion, and recorder observability: long tasks, element animations, and whether its own animation channel ever fired.
- `overrides.active`: all `flemo:*` keys in both storages, unknown keys, keys cleared since attachment, and retired persisted keys marked inert. Since 2026-08-31, flemo reads no `flemo:*` engine key; `overrides.warnings` explains each residue key.
- `flights[]`: identity, router, bucket, navigation kind, timestamps, duration, detected driver, participants, holds, frame and phase statistics, motion, images, shared elements, tripwire hits, what drove the flight, long tasks, landing checks, and stable anomaly strings.
- `comparison[]`: per-bucket medians, worst gaps, drops, anomalies, and stalls; empty until `mark()` arms a label.
- `previousSession`: flights carried across the last full page load, separate from live flights.
- Session `anomalies`, constant `blindSpots`, and constant `judgingProtocol`.

Per-flight `driver` is `compiled`, `inline`, `mixed`, or `unknown`; never infer it from platform policy. flemo compiles every animation, so `inline` means something else is writing frames onto a participant.

`holds.releasedAtMs` is the last release relative to `t0`. Held work is intentionally absorbed: frame gaps and long tasks are separated into held and released phases, and held gaps do not raise anomalies.

See [flight measurements](flight-measurements.md) for motion, morphs, tripwires, input, images, and landing audits.
