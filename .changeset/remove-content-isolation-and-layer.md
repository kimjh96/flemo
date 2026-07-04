---
"@flemo/react": minor
---

Remove the translateZ(0) content isolation and the `<Layer>` component. The isolation targeted a WebKit stall whose real cause was the animation-start anchoring (fixed by `data-flemo-anim-hold`); with the anchor in place, isolated and non-isolated runs measure identical on WebKit and identical-or-better on Chrome frame telemetry. Without the transformed box there is no containing block trapping `position: fixed` overlays, so `<Layer>` — which existed only as the escape hatch — is gone too: a plain fixed overlay inside screen content now works directly, rides transitions with the screen, and stacks with ordinary z-index.
