---
"@flemo/core": minor
"@flemo/react": minor
---

Cross-fade a shared bar's `<Part>` elements between screens that match on `sharedTopBarId` or `sharedBottomBarId`. Both sides already received the right status and ran the right keyframes, but each screen renders its own copy of the bar inside its own isolated container, so the covered screen's part animated under the other screen's opaque surface and was never seen. On a pop it was worse than invisible: the returning part finished its enter animation while occluded, then appeared un-transitioned the moment the departing screen was released.

The covered side's parts now spend the flight in a Router owned part layer above both screens, at the rect they occupied, and go back exactly as they were on landing. A stand-in holds the part's place so the bar keeps its layout while it is away. This works on push, pop, replace and the interactive swipe, and needs nothing from the application: no bar z-index to coordinate and no selectors on internal `data-flemo-*` attributes.

A `<Part>` also takes its clock from the flight carrying it, which is the rule decorators already follow and by the same same-variant-key mapping. A part states a pose; how long the hand-over takes is the flight's answer and the flight already gave it. Restating it is how the two drift apart, and omitting it used to resolve to zero: the part snapped under a screen running for three quarters of a second, while a part authored longer than its screen held the whole flight open and disabled swipe-back for as long as it ran. A part's variant states its clock optionally, the way a decorator's already does, so a pose can be written without one.

What rides a flight now follows the finger too. A drag flips no status, so the compiled rules never matched and a `<Part>` or a decorator that declared only a pose sat still while the screens moved under it: only an author who hand wrote `onSwipe` got anything, restating in imperative code the pose they had already declared. The gesture now stages those animations itself and scrubs them, which is the model `<Morph>` has used since it learned it, and an authored `onSwipe` still overrides. A committed swipe marks each rider so the landing does not replay it from its start, the contract the swipe already applied to the screen and the dim.
