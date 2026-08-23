---
"@flemo/core": patch
---

Measure a swipe's release velocity over a short window instead of the last pointermove pair. A release's length divides by that number, so one unlucky pair — browsers coalesce pointer events and batch them behind a busy frame — could report several times the finger's real speed and collapse the landing onto its floor. With 30% of the screen left, an honest 600 px/s asks for a 0.21s settle where a spurious 2000 px/s gets 0.12s.
