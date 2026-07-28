---
"@flemo/core": patch
"@flemo/react": patch
---

Warm the compositor for the length of every flight and decode oversized images off the main thread. Fixes the one-frame opening judder on cold transitions and the WebKit tab fade being swallowed when a fetching screen's image decode lands inside the flight.
