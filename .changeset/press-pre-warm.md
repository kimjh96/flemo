---
"@flemo/core": patch
"@flemo/react": patch
---

Pre-warm the compositor on pointerdown. The per-flight warm-up starts with the flight, so a session's first navigation still paid the pipeline's cold spin-up inside its opening frames. A press precedes its navigation by 50-300ms; warming at the press puts every flight — including the session's first — on an already-spinning compositor.
