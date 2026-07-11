---
"@flemo/core": patch
"@flemo/web": patch
---

Make <Part> motion natural across a swipe. Cleanups (COMPLETED strips, unmounts) now drop any in-flight settle without writing, so a late settle can never shadow the rest rules, and a committed swipe keeps the previous side's part landing values in place instead of stripping them a frame early (the engine's COMPLETED cleanup owns the strip). The playground's panel-title Part gains the reference swipe hooks: the returning screen's title recovers with the drag progress and settles the remainder on release, matching how the screens themselves move.
