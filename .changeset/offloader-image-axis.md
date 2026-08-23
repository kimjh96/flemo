---
"@flemo/core": patch
"@flemo/devtools": patch
---

Let the image decide whether the decode offloader runs, not the browser. It was armed by a browser-age probe, and the cost it removes is not created by the browser: a 48px avatar holding a 37-megapixel original is expensive to decode wherever it lands. The offloader already makes the decision that matters — per image, from the source's own bytes — and leaves a well-sized one exactly as authored.
