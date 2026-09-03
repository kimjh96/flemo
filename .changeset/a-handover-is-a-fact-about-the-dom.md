---
"@flemo/core": patch
---

Lift a shared bar's parts before the flight is painted, not two frames into it. Staging waited on the `bar-riding` flag, which the binding computes from the partner's registration and therefore publishes one render late, so the covered side's `<Part>` was re-parented after two frames had already been drawn with it in place. WebKit rebuilds the layer of a live element it re-parents, which reads as the part blinking out and back before its partner fades in. Whether a bar is handed over is now read from the DOM the flight starts with, where the partner's copy is already present.
