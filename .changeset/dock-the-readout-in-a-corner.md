---
"@flemo/devtools": minor
---

Dock the on-device readout in a corner and give it a hide control. `position`
now takes any of the four corners as well as the centred `"top"` and `"bottom"`
strips, and defaults to `"bottom-right"`, opposite the panel's toggle. The pill
beside the readout hides it down to itself and brings it back, remembering the
choice for the session, and a hidden readout stops polling rather than merely
going invisible.
