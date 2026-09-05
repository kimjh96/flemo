---
"@flemo/core": patch
---

Stop measuring a morph that has no container to be staged inside. Registration runs in a layout effect, in the frame React has just mutated the DOM, so the measurement it took was a synchronous layout of the whole page at the most expensive moment there is, repeated for every render of every morph. The value is only ever read to beat a staged container, which an element with no morph above it does not have. Device-read on a consumer's tab switch: one call at 25ms after the landing and one at 9ms at the tap, on a navigation with nothing nested in it at all.
