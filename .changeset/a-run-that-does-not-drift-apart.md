---
"@flemo/core": patch
---

Cancel the drift a growing run of text picks up on faces whose glyph advances do not track their size. The run's width is measured off-screen at sixteen sizes along the flight and the deviation from the straight line between its ends is spread over the gaps as tracking, so later characters stop wandering further than earlier ones. Named families sit on that line already and measure a correction of nothing; `system-ui` and `-apple-system` deviate by a full pixel in both engines, and now land within a face that never had the problem.
