---
"@flemo/core": patch
---

Stop animating the box size of a nested re-typesetting pair. Type moves by font-size and its box belongs to layout; forcing the captured block width onto a flex row reflowed the siblings every frame.
