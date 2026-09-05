---
"@flemo/web": patch
---

Arm the devtools on the playground with `?devtools=on` instead of importing
them unconditionally, and mount the on-device readout beside the panel so a
device round has numbers on the glass instead of a console it does not have.
The arming matters more than it looks: a plain import of `@flemo/devtools`
resolves to its inert production entry, so wired the ordinary way the panel
mounted nowhere in a production build, which is the only build the judging
protocol accepts. The choice persists in `flemo:devtools` and `?devtools=off`
clears it; a session that never asks loads nothing at all.

Adds an end-to-end net for the swipe release: the dim has to read the screen
rather than the finger when a drag comes back past its start, a committed
release has to cross the screen as motion rather than in one frame, and one
case drives the whole gesture with real touch events.
