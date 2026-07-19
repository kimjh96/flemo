---
"@flemo/core": minor
"@flemo/react": minor
---

Glass-integrity and responsiveness fixes for heavy screens. The flight-time animation quarantine is now pose-preserving: consumer animations pin to their first-keyframe pose during the flight and rejoin their original clock at the landing, so delayed reveals (skeleton gating) never flash their base styles or restart their delay. An opening-clock guard covers the compiled CSS driver across the whole flight on non-Blink engines: spans a main-thread block advanced without presenting are rewound frame by frame, so navigations play their full motion instead of starting past the middle. Held arrivals keep their lazy images loading and decoding off-glass. The diagnostic motion-driver force pin expires after 24 hours (stale plain pins are removed on sight). And routes whose full-content mount measurably froze the tap (past ~80ms) are learned per device and enter as a shell on later visits — content renders at hidden background priority and reveals at rest through the app's own loading states, so the tap always answers immediately.
