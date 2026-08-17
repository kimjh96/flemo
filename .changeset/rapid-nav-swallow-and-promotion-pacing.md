---
"@flemo/core": patch
---

Fix rapid navigation swallowing the transition on the compiled tier, and steady Chrome's ProMotion frame pacing during compiled flights.

A stale resolver (a finished flight's animationend/cancel firing a frame into the next one) could resolve the CURRENT task instead of its own, flipping `data-flemo-status` to COMPLETED at the exact frame the new flight released its hold — un-matching the running `@keyframes` rule and cancelling the slide mid-opening, so a fast Next/Back burst committed the navigation but showed no motion. Each flight now resolves only its own captured task, so a late resolver can never cut a newer flight.

Separately, a compositor-driven flight left the main thread idle, and Chrome then paced its macOS ProMotion presentation unevenly (dropped/duplicated frames mid-slide, read as convergence trembling). A lightweight frame-pacing keepalive now holds a live frame source across compiled Blink flights so the panel stays at its full refresh rate.
