---
"@flemo/core": patch
---

Cancel the drift a growing run of text picks up on faces whose glyph advances do not track their size. The run's width is measured off-screen at sixteen sizes along the flight and the deviation from the straight line between its ends is spread over the gaps as tracking, so later characters stop wandering further than earlier ones. A run has to be at least half a pixel off that line before anything is emitted, because tracking reaches the glass on a 1/64px grid and a correction below it can only add a staircase of its own. Named families sit on the line already and are left completely alone; `system-ui` and `-apple-system` deviate by a full pixel in both engines, and now land within a face that never had the problem.
