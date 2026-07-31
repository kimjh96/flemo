---
"@flemo/core": patch
---

Land the in-flight arrival hold inside the transition's sub-pixel tail instead of after the COMPLETED flip. Once every participant of the choreography is within one CSS pixel of rest, the held content reflects while the compositor still owns frame production, keeping the release commit's layout and paint cost out of the settle window; unanalyzable choreographies keep the deferred post-COMPLETED landing.
