---
"@flemo/core": patch
---

Take a nested morph's resting box from the flight that carries it, in that flight's own read pass, instead of from the element's registration. Registration runs in a layout effect in the commit the framework has just mutated, so the measurement was a forced layout of the whole document at the most expensive moment in the frame, repeated for every nested morph on every navigation. It also can no longer be taken while the element is in the air, which used to pin a landing to the box the flight was holding.
