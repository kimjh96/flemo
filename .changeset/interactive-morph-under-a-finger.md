---
"@flemo/core": minor
"@flemo/react": minor
---

Let a swipe drive a morph. The shared element now stages its flight when the drag starts — both ends are already on screen, so the destination can be measured — holds it at zero, and follows the finger, then plays out to the arrival on a commit or back to where it started on a cancel, at the same speed the screens settle at. It runs no frame loop of its own: the animations are the browser's, and the gesture sets their time. Any transition that declares a `swipeDirection` gets this without authoring anything.
