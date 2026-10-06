# Judging protocol and blind spots

A report counts as evidence only from a session with:

- DevTools closed and no screen capture.
- Real input and emulation off.
- A production build and an idle machine.
- A known display, refresh rate, HiDPI scaling and Low Power Mode state.

`preconditions` contains the checks observable by the page: emulation, display cadence, foreground state, machine load, build mode, real and touch input, and reduced motion. Other conditions remain `unknown` there and are listed in `judgingProtocol`.

An open DevTools window caused the residual stutter investigated in 2026-08. Screen capture can hide symptoms; dispatched synthetic events skip the `pointerdown` gesture path.

`blindSpots` lists layers the page cannot observe:

- Frame presentation in macOS Chrome on 120 Hz ProMotion displays (Chromium issues 40062488 and 345275139).
- Display hardware.
- Frames skipped internally by the compositor.
- The scaled surface drawn by DevTools emulation.

If a correctly judged report is clean but stutter remains visible, investigate these layers instead of adding more in-page measurement.
