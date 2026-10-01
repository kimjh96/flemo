# Judging and sharing reports

## Judging protocol and blind spots

A valid verdict requires DevTools closed, no capture, real input, emulation off, a production build, an idle machine, and known display, refresh rate, HiDPI scaling, and Low Power Mode state.

Page-observable checks appear in `preconditions`: emulation, display cadence, foreground, machine contention, build mode, real and touch input, and reduced motion. The remaining conditions stay `unknown` there and are stated in `judgingProtocol`.

Open DevTools caused 2026-08 residual stutter; capture can suppress symptoms; synthetic dispatch bypasses `pointerdown` gesture behavior.

In-page tools cannot observe macOS Chrome present-pipeline pacing on 120 Hz ProMotion (Chromium issues 40062488/345275139), display hardware, compositor-internal present skips, or the post-scale DevTools emulation surface. These remain in `blindSpots`. If a correctly judged report is clean but jank remains visible, investigate these layers instead of adding in-page instrumentation.

## Hand a report to an agent

1. Reproduce once with the recorder attached.
2. Run `copy(JSON.stringify(window.flemo.report(), null, 2))`.
3. Paste the JSON into the issue or conversation.

Read `verdict`, then `preconditions`, then each flight's `anomalies`, then `blindSpots`. A number from a session with a violated precondition is not evidence.
