---
"@flemo/core": minor
---

Hold the first frames of a transition on desktop macOS Safari until the browser
can actually present them. A compiled clock there starts at the release update's
style resolution but reaches the glass a pipeline later, so the curve used to be
entered partway and the motion read as too fast. The screen now waits out that
latency at its authored start pose, the way touch WebKit already does.
`flemo:deskhead=off` restores the previous behavior.
