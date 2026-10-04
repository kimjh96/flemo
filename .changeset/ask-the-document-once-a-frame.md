---
"@flemo/core": patch
---

Ask the document once for the animations a transition has to carry, instead of once per participant. `getAnimations` resolves style before it answers, so on the frame a tap starts each participant paid for the writes made by the ones before it: measured in Chrome on a warm push, four asks at 0.2ms and then one at 3.8ms that found nothing and one at 3.6ms, from a frame that has 8.3ms to spend at 120Hz. One shared answer per task takes that from 6.9ms to 4.2ms.
