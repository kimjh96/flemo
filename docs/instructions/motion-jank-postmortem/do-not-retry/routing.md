# Routing falsifications

- **Touch-Blink blanket compiled routing** regressed fast Blink: Pixel 9 gained compiled landing artifacts. Keep routing per signal (high-refresh / demoted / legacy), not per platform. Touch-WebKit later adopted governed-compiled routing wholesale with the flat-head kit; the engine and reasons differ, so neither is precedent for the other.
- **LPM-detection driver switching, all forms** — LPM caps rendering updates for the whole web process at about 30Hz. Timer-driven clocks are equally capped; longTasks are EMPTY during 100–340ms gaps, proving an OS governor. Every supervisor runs on rAF, making compiled-under-LPM unsupervisable. Static 2x duration stretch was rejected on feel. The successful LPM change was literal timing plus flat-head keyframes: active from birth, with the commit in the invisible head. This generalized to all touch WebKit; it was not a routing fix.
- **`scrub` on Note9, or any timing/transform/hide fix for Mode-B swallow** — the swallow is late content paint, not clock advance. Frozen transforms cannot fix it; only pixel reduction through offloader downscale works.
- **park-over (0.02-opacity on-top pre-raster)** caused ghosting and stacking side effects. Its culling theory was a misdiagnosis; var-timing was the culprit. Retained only behind `flemo:preraster`.
- **Opacity masking, render-freeze (React visible+frozen), and consumer-blur blame** were all falsified for WebKit swallow.
- **content-visibility fold landing on Note 9** creates a second hitch on old CPUs when deferred unhide repaints.
- **Moving the rest landing commit on Note 9 / LPM** — all three placements were device-judged: mid-transition was least bad, COMPLETED caused an end hitch, and pre-release belonged to the deadlock era. Keep early landing.
