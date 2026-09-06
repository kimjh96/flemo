---
"@flemo/core": minor
"@flemo/react": patch
"@flemo/web": patch
---

Let `createPartTransition` name the pose of the part on the screen being popped, as an optional `dismiss` beside `idle`, `enter` and `exit`. Two matched parts could cross-fade on a push but only reveal on a pop, because the dismissing side was pinned to `idle` and the sole way to move it was to restate all ten variants through `createRawPartTransition`. Omitting `dismiss` holds the part still exactly as before, and the Part docs now say where each slot animates from.
