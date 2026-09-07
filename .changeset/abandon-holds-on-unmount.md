---
"@flemo/core": patch
---

Hand back the session-global holds a screen armed when that screen unmounts
mid-flight. Every hold is released by a later drive pass, and a screen taken out
before its own completion never has one, so the response park and the flight
window stayed latched with nothing in the air: the window gates the image decode
offloader and the layer settle hold, which then deferred image reveals and layer
demotions for the rest of the session. Released only when the screen has really
gone, never between two passes of the same flight.
