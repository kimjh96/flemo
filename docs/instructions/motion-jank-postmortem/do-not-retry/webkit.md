# WebKit clock and animation changes

- **Timing writes to running/pending WebKit accelerated animations** — rewinds, `startTime` pins, two-phase holds, and pending-clock pins lose the race, desynchronize out-of-process re-sync, or make WebKit cut the transition to its end about 100ms in (trajectory-measured). Surviving exceptions: one-shot birth-window rewind on desktop WebKit, and pause/play first-frame hold only for authored `driver:"native"` pins.
- **Post-birth `animation-delay` extension** — the UI process autonomously counts down the delay and has already presented motion frames. The extension commit snaps back to the from-pose and restarts, causing tab flash / push stutter. Decide the entire hold before animation birth.
- **Accelerated-tail handoffs for player-opened transitions:**
  1. `scrub.play()` loses the paused+scrubbed WAAPI animation's accelerated representation. The remainder follows wall time through blocks: freeze then leap, worse than the capped player.
  2. Compiled-CSS rebirth with negative inline `animation-delay` is smooth per transition but intermittently freezes then rushes when a mid-transition suspense commit forces accelerated re-sync. Its unusual begin time desynchronizes what a naturally born animation survives. It also revives the engine's `animationend` resolver and double-resolution bug: a duplicate resolution's deferred chain cuts the NEXT queued task; fast-back pop completed around 90ms with no motion.
  3. Fresh remainder animation with `linear()` easing has no Core Animation form, runs on the main thread, and restores convergence stutter. The baked-keyframe accelerated variant hits the same re-sync desynchronization as design 2.
  The handoff survives only as a POP-scoped opt-in diagnostic.
- **CSS `calc(var())` in animation timing** demotes WebKit fades off the compositor: a 2-frame collapse under starvation, bisected in a local rig. Timing must be literal; the compiler enforces this.
- **Adaptive/learned hold sizing from gap statistics** — the leisure ledger learns gap length, but the needed value is trouble-window position. Every gap statistic under-covered: 7/7 swallowed below the threshold. Static per-status heads won.
- **Calm-frame release gating from rAF gaps** — ordinary mount aftermath looks like a storm on high-refresh devices. The gate reaches its bound, adding only dead-wait.
