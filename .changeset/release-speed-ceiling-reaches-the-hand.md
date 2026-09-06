---
"@flemo/core": patch
---

Lower the ceiling on how far a swipe release may outrun the transition it is completing, from three times the authored motion's average speed to 1.2 times. The old value was chosen so that it would sit above any human flick, which meant the finger's own speed decided every release a person can actually make and a brisk one crossed the screen at up to 2.9 times the button-driven pop. Slower releases and every cancel are unchanged; the new value was picked on a device from a ladder of builds differing in nothing else.
