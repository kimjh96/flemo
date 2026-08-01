---
"@flemo/core": patch
---

Re-anchor the covered screen with the active one on main-thread stalls. The native stall re-anchor only shifted the active scope's participants, so on engines that present from the main thread a stall resumed the entering screen smoothly while the covered screen's parallax teleported the stalled span in one frame (the visible parallax snap on mobile Safari). The watcher now shifts every sibling screen's timeline in the same breath, with overlapping watchers deduplicated per frame.
