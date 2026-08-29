---
"@flemo/core": minor
"@flemo/react": minor
"@flemo/web": patch
---

Run a decorator on the clock of the transition that names it. Timing on a decorator variant is now optional and inherits the screen's duration and delay for the same variant key, so one dim is longer on a slow transition and shorter on a fast one without being authored twice; write a `duration` only to override it, including `0` to snap, and note that a variant that previously omitted one snapped where it now inherits. `ease` is never inherited.
