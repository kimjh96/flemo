# (c) DO-NOT-RETRY list

Each entry was implemented, deployed, and **falsified on real devices** (not in theory). Do not re-attempt without genuinely new information; if you must, read the full ledger in the session memories / git history first.

## Clock & animation surgery (WebKit)

- **Any timing write to a running/pending WebKit accelerated animation** — rewinds, `startTime` pins, two-phase holds, pending-clock pins: either loses the race, desyncs the out-of-process re-sync, or WebKit cuts the flight to its end (~100ms in, trajectory-measured). The narrow exceptions that survive: the one-shot *birth-window* rewind (desktop WebKit) and pause/play first-frame hold for authored `driver:"native"` pins only.
- **Post-birth `animation-delay` extension** — the UI process counts the delay down autonomously and has already presented motion frames; the extension commit snaps them back to the from-pose and restarts (tab flash / push stutter). "The hold must be fully decided before the animation is born."
- **The three handoff designs** (giving a player-opened flight an accelerated tail):
  1. `scrub.play()` — a paused+scrubbed WAAPI animation loses its accelerated representation when played; the remainder rode the wall clock through blocks (freeze then leap — worse than the capped player).
  2. Compiled-CSS rebirth with a negative inline `animation-delay` — smooth per flight, but intermittently froze-then-rushed when a mid-flight suspense commit forced WebKit's accelerated re-sync; the unusual begin time desyncs exactly what a naturally-born animation survives. Also revived the engine's `animationend` resolver → the double-resolution bug (a duplicate resolution's deferred chain cuts the NEXT queued task — fast-back pop completed at ~90ms with no motion).
  3. Fresh remainder animation with `linear()` easing (and the baked-keyframe variant) — `linear()` has no Core Animation form → main thread → convergence stutter back; the baked accelerated variant hit re-sync desync (2). Net: the handoff survives only as a POP-scoped opt-in diagnostic.
- **CSS `calc(var())` in animation timing** — demotes WebKit fades off the compositor (2-frame collapse under starvation; bisected in a local rig). Timing must be literal; the compiler enforces this.
- **Adaptive/learned hold sizing from gap statistics** — the leisure ledger learns gap *length*, but the needed value is trouble-window *position*; every gap statistic under-covered (7/7 swallowed below the threshold). Static per-status heads won.
- **Calm-frame release gating by rAF gap evidence** — on high-refresh devices every ordinary mount aftermath reads as a storm; the gate rode its bound = pure added dead-wait.

## Routing

- **Touch-Blink blanket compiled routing** — regressed fast Blink (Pixel 9 picked up compiled landing artifacts); routing must stay per-signal (high-refresh / demoted / legacy), not per-platform. (Note the *touch-WebKit* side later DID go governed-compiled wholesale, with the flat-head kit — same destination, different engine, different reasons; don't cite one as precedent for the other.)
- **LPM-detection driver switching, all forms** — LPM caps the whole web process's rendering updates at ~30Hz (proven: timer-driven clocks are equally capped, and longTasks are EMPTY during the 100-340ms gaps — pure OS governor). Every supervisor runs on rAF, so compiled-under-LPM is definitionally unsupervisable; duration stretch (static 2x) was rejected on feel. What finally worked under LPM was NOT routing: literal timing + flat-head keyframes (active-from-birth, commit lands in the invisible head) — which then generalized to all touch WebKit.
- **`scrub`-on-Note9 / any timing/transform/hide fix for Mode-B swallow** — its swallow is late *content paint*, not clock advance; freezing transforms can't touch it. Only pixel reduction (offloader downscale) works.
- **park-over (0.02-opacity on-top pre-raster)** — ghosting + stacking side effects; its motivating culling theory was a misdiagnosis (real culprit: var-timing). Kept only behind `flemo:preraster`.
- **Opacity masking, render-freeze (React visible+frozen), consumer-blur blame** — all falsified for the WebKit swallow.
- **content-visibility fold landing (Note 9)** — the deferred unhide's repaint is a second hitch on old CPUs.
- **Moving the rest landing commit around (Note 9 / LPM)** — all three placements device-judged (mid-flight = least bad, COMPLETED = end hitch, pre-release = deadlock era); the early-landing placement stays.

## Chrome-present-pipeline angles (all measured ineffective against layer-1)

- Driver choice (compiled vs player), every easing shape (snap/governor/60Hz cadence-lock/bezier), every warm variant (per-flight, interaction, permanent 1px, fullscreen), keepalive rAF on/off, `canvas.captureStream` video, real hardware-decoded h264 video, the CADisplayLink flag, page-side present-timing compensation (future present times unknowable). **VRR-area hypothesis dead**: VRR max-rate is requested by animation *existence*, area-independent — a permanent 1px warm already requested it and the tremble persisted.
- (One warm DID survive falsification and shipped: the *never-stopping* keepalive rAF for compiled Blink flights — an on/off per-flight loop barely helped, the permanent one device-confirmed. It steadies pacing; it does not fix layer-1.)

## Player micro-policies

- **Jitter-cap + commit-miss compensation from a synthetic A/B** — real pages carry per-frame render cost that reads as a blown commit window; the compensation held frames constantly (synthetic win did not transfer). Noted in `stepPlayer`; do not re-attempt without an adaptive per-page baseline.
- **MIN-estimator display interval** — one runt gap throttled the whole flight; the median with a sustained-slow requirement is deliberate.
- **Per-flight warm variants** as a present-pacing fix — see above; only the session-permanent form helps.

## Falsification map — additions from the 2026-08-18 live glass campaign

- **Per-frame `!important` snap mask (tailSnap)**: directly refuted by the cross-correlation profile — it turns the slow segment into integer stairs (+1/0/+1/0), and if rAF slips a beat the stale pose pins the screen (a 0 followed by a doubled jump). The pure-CSS control was smooth with fractional monotone deceleration. Snapping only holds "when that driver is the sole writer" (the player's self-clocked snap). The mask is forbidden.
- **Pre-quantized step-end WAAPI ladder**: live verdict "much worse" — step timing comes down off the compositor and inherits the main-thread failure modes (without re-anchoring). Forbidden.
- **Pop-only player routing**: the start freeze persists in the player too (plus a user-rejected texture). The freeze is not below the style layer (see the final attribution) and cannot be solved by routing.
- **parallax = 0 / cupertino 550ms**: valid as diagnosis (confirmed partial contribution to the tremor), rejected as prescription — conflicts with the library requirement to handle arbitrary authored transitions.
- **Near-viewport image predecode on drive entry**: forced layout from one getBoundingClientRect per row rides the release path and backfires (live verdict: worse). Forbidden unless moved off the flight path (idle/IO-based).
- **Renderer damage expansion (48px raster / 40vw surface) and silent-audio QoS**: the capture-client effect could not be reproduced from the page. The 40vw resize also causes layer churn on every interaction. The only verified page-side mitigation is a **resident small 60fps video surface** (live verdict: "a bit better").
