---
"@flemo/core": patch
---

Fix the swipe-back gesture not starting. The controller located the previous screen through a freeze wrapper element that the React `<Activity>`-based screen freeze no longer renders, so the drag found no screen to reveal and bailed. It now walks direct sibling containers to find the previous screen.
