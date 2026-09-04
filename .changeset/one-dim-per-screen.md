---
"@flemo/core": patch
"@flemo/react": patch
---

Render a screen's dim once. A screen with a `<Layer>` slot rendered its decorator twice, once in its own container and once out in the layer host, so the dim painted twice over and read 19% where the decorator asked for 10%. The copy in the host is the one that covers what an overlay carried out, so it is now the only one, and every handle points at it. A drag also reaches it: the decorator's riders no longer wait on a bar-part staging that a screen with no shared bar never satisfies, and the covered screen's dim is found by the screen that owns it rather than by where it sits.
