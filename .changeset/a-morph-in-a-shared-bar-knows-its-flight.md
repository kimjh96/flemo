---
"@flemo/core": patch
"@flemo/react": patch
---

Pair a `<Morph>` rendered in a shared bar. A shared bar is a sibling of the screen scope it belongs to, so the nearest `[data-flemo-screen]` above it belongs to another Router or to nothing at all, and both ends of a bar-to-bar pair resolved to the same screen and never flew. The binding now stamps the flight it is on, and the runtime reads the side from that while still taking its transform correction from the screen it is physically inside.
