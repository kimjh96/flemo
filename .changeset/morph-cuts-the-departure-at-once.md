---
"@flemo/core": patch
---

Cut a morph's departing element at the flight's first frame instead of over a one-frame window. The element left behind rides its screen while the flight does not, so any frame that catches it still painting draws a second copy of it offset from the real one — which is what a dropped frame on desktop Safari was doing, leaving a sliver of the card beside the element on both push and pop.
