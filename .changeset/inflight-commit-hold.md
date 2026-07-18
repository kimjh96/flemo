---
"@flemo/core": minor
---

Hold in-flight content changes until the screen is at rest. A cold navigation's async data can land mid-flight — section swaps, streamed additions, and in-place text/attribute updates — while the screen is still decelerating, which reads as mid-transition stutter. The engine now parks departing nodes, holds arrivals off-glass, and reverts in-place writes during the flight, reflecting everything in one commit at COMPLETED (or the instant the transition is interrupted) — the shipped delayed-but-complete contract extended from mount time to flight time.
