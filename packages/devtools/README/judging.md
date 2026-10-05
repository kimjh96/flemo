# Judging and sharing reports

## Judging protocol and blind spots

A report counts as evidence only from a session with DevTools closed, no screen capture, real input, emulation off, a production build, an idle machine, and a known display, refresh rate, HiDPI scaling and Low Power Mode state.

The checks a page can observe appear in `preconditions`: emulation, display cadence, whether the page was in the foreground, machine load, build mode, real and touch input, and reduced motion. The other conditions stay `unknown` there and are listed in `judgingProtocol`.

An open DevTools window caused the residual stutter investigated in 2026-08, screen capture can hide symptoms, and dispatched synthetic events skip the `pointerdown` gesture path.

Some layers cannot be observed from inside the page: frame presentation in macOS Chrome on 120 Hz ProMotion displays (Chromium issues 40062488 and 345275139), the display hardware, frames the compositor skips internally, and the scaled surface DevTools emulation draws. These are listed in `blindSpots`. If a correctly judged report is clean but the stutter is still visible, investigate those layers instead of adding more in-page measurement.

## Hand a report to an agent

1. Reproduce the problem once with the recorder attached.
2. Run `copy(JSON.stringify(window.flemo.report(), null, 2))`.
3. Paste the JSON into the issue or conversation.

Read `verdict` first, then `preconditions`, then each transition's `anomalies`, then `blindSpots`. A number from a session with a violated precondition is not evidence.
