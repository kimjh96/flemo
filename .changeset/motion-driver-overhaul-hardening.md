---
"@flemo/core": minor
"@flemo/react": minor
---

Motion driver overhaul hardening: device-verified fixes across five external review rounds plus two device-measured features.

- Response hold parks every fetch method (reveal queries arrive as POST RPCs and HEAD counts too), never streams, with the self-release backstop bound to the whole choreography's span.
- Owner-scoped, composable holds: layer settle holds refcount per-instance tokens and compose requirements as a union over the element's own inline values; inline writes and settle execution are writer-scoped leases; the owner-less force form remains the flight-over authority.
- Blink detection via the UA-CH Chromium brand (WebKit's userAgentData no longer misreads Safari); stall strikes judged at each run's final measured cadence, so a genuinely slow display never demotes the player.
- Player correctness: per-track writer tokens, sustained slow-cadence clock adoption with next-flight seeding, authored transform order preserved (non-canonical or padding-incompatible motions fall to the scrub tier), and the navigation resolves on the player's own clock once every track finishes.
- Whole-choreography completion on every path (gate, floor, perceptual cut, early landing, screens-motionless case), with participants scoped to one Router's flight via explicit `data-flemo-router` markers stamped by the React binding on screens, shared bars, and parts.
- Async image decode for flight participants: `decoding="async"` stamped on a transitional screen's images (and arrival-held content just before reveal) unless the consumer authored one — a device-measured 37MP portrait no longer freezes mid-flight.
- Platform-density snap default: WebKit below 3x snaps every frame (desktop texture-resampling sizzle, device-judged), phone densities and Blink keep the velocity gate; plus opt-in resident-layer and shallow-freeze diagnostics.
- Native first-frame hold disposes its backstop and stale callbacks; GPU prewarm is Blink-gated, refcounted, and deferred while a flight is active; landing snap honors sub-1 device pixel ratios.
