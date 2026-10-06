# Falsifications from the 2026-08-18 live glass campaign

- **Per-frame `!important` snap mask (tailSnap)** is forbidden. Cross-correlation directly refuted it: the slow segment becomes integer stairs (+1/0/+1/0); a slipped rAF beat leaves a stale pose pinning the screen, producing 0 then a doubled jump. The pure-CSS control showed smooth fractional monotone deceleration. Snapping works only when the driver is the sole writer, as with the player's self-clocked snap.
- **Pre-quantized step-end WAAPI ladder** is forbidden. Live verdict: “much worse.” Step timing leaves the compositor and inherits main-thread failure modes without re-anchoring.
- **Pop-only player routing** — the start freeze persists in the player, with a user-rejected texture. The freeze is not below the style layer (see final attribution) and cannot be fixed by routing.
- **parallax = 0 / cupertino 550ms** is valid diagnosis: it confirmed a partial contribution to tremor. It is rejected as prescription because the library must handle arbitrary authored transitions.
- **Near-viewport image predecode on drive entry** is forbidden unless moved off the transition path to idle/IO-based work. One getBoundingClientRect per row forces layout on the release path; live verdict: worse.
- **Renderer damage expansion (48px raster / 40vw surface) and silent-audio QoS** did not reproduce the capture-client effect from the page. The 40vw resize also churns layers on every interaction. The only verified page-side mitigation is a resident small 60fps video surface; live verdict: “a bit better.”
