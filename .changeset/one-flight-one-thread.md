---
"@flemo/core": patch
---

Present every part of a morph flight on the thread that presents the element it is placed against. A ghost, a nested pair and a `carry: "screen"` camera were each free to be run by the compositor while the element travelled by its box on the main thread, so they advanced on frames the element never reached. This applies to any transition, authored or preset, rather than to any one of them.
