---
"@flemo/core": minor
"@flemo/react": minor
---

Cross-fade a shared bar's `<Part>` elements between screens that match on `sharedTopBarId` or `sharedBottomBarId`. Both sides already received the right status and ran the right keyframes, but each screen renders its own copy of the bar inside its own isolated container, so the covered screen's part animated under the other screen's opaque surface and was never seen. On a pop it was worse than invisible: the returning part finished its enter animation while occluded, then appeared un-transitioned the moment the departing screen was released.

The covered side's parts now spend the flight in a Router owned part layer above both screens, at the rect they occupied, and go back exactly as they were on landing. This works on push, pop and replace, and needs nothing from the application: no bar z-index to coordinate and no selectors on internal `data-flemo-*` attributes.
