---
"@flemo/core": minor
"@flemo/devtools": minor
---

Export the `flemo:*` diagnostic-flag registry from `@flemo/core` as data — `DIAGNOSTIC_FLAGS` and `RETIRED_DIAGNOSTIC_FLAGS` declare every storage key the library reads, its default, and the keys it has stopped reading. It replaces a comment table that had drifted from the code, and it is now held to the readers in both directions: a key read without a row, or a row nothing reads, fails the build.

`@flemo/devtools` mirrors that registry field for field instead of hand-copying it (its runtime stays dependency-free), so reports name every live flag, state the default an override is departing from, and stop listing the panel's own storage key as unknown. `FlagDescriptor` gains `values` and `fallback`, and its `description` field is now `effect`.
