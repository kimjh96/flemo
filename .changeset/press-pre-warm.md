---
"@flemo/core": patch
"@flemo/react": patch
---

Pre-warm the compositor while the user interacts. The per-flight warm-up starts with the flight, so the first navigation after an idle period still paid the pipeline's wake-up inside its opening frames. The warm-up now rides any interaction (pointer movement, wheel, touch, keys) — a pointer moving toward a tap precedes it by seconds — renewed at a throttled cadence and released shortly after interaction stops.
