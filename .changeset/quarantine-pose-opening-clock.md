---
"@flemo/core": patch
---

Glass-integrity fixes for heavy screens, all measured on a production consumer. The flight-time animation quarantine is now pose-preserving: consumer animations pin to their first-keyframe pose during the flight and rejoin their original clock at the landing, so delayed reveals (skeleton gating) never flash their base styles or restart their delay. An opening-clock guard covers the compiled CSS driver across the whole flight on non-Blink engines, rewinding spans a main-thread block advanced without presenting, so navigations play their full motion instead of starting past the middle. Held arrivals keep their lazy images loading (bounded to a viewport's worth) and the landing decodes them off-main before revealing, keeping WebKit's synchronous paint-time image decode off the settle frames. The diagnostic motion-driver force pin expires after 24 hours, and stale plain pins are removed on sight.
