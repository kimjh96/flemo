---
"@flemo/web": patch
---

Mount the devtools on-device readout beside the panel on the playground, so a
device round has numbers on the glass instead of a console it does not have.
Adds an end-to-end net for the swipe release: the dim has to read the screen
rather than the finger when a drag comes back past its start, and a committed
release has to cross the screen as motion rather than in one frame.
