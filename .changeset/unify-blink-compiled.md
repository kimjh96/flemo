---
"@flemo/core": minor
---

Route Blink to the compiled tier everywhere. Desktop Blink already did; touch Blink defaulted to the rAF player and reached the compiled tier only by demotion — two stalled flights, persisted per origin, and re-probed once per session, so the first flight after every page load ran the player even on a device whose ledger already said "css". A weak phone's behavior therefore depended on which origin it had visited and how recently it reloaded. Blink is now one rule from the first flight, and demotion is off everywhere since its only purpose was reaching a tier Blink now always uses. WebKit is unchanged: there the compiled tier swallows its opening and the player stays device-verified. The `flemo:motion-driver-force=raf` pin still pierces.
