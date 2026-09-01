---
"@flemo/core": patch
---

Give each history its own serial lane for navigation tasks. A `history="memory"` Router no longer queues behind unrelated Routers on the page, so a looping in-memory demo can no longer delay a real navigation.
