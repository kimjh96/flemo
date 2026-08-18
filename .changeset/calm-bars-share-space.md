---
"@flemo/core": minor
"@flemo/react": minor
---

Add optional shared top and bottom bar IDs so only semantically matching bars hand over in place. Reuse matching partner measurements and synchronously reserve newly measured bar heights before paint, while retaining the legacy position-only behavior when IDs are omitted.
