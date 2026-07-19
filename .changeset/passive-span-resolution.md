---
"@flemo/core": patch
---

Resolve reveal-shaped transitions (static enter over an animated exit) on the passive side's motion span, keeping the navigation task anchored to the visible motion instead of resolving on a microtask.
