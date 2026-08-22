---
"@flemo/core": minor
---

Give a cupertino swipe's release the length its gesture asks for. It ran a fixed 0.3s whether six pixels or three hundred were left, so a swipe-completed pop landed in a different time — and read as a different motion — from the identical pop driven by a button, whose authored span is 0.7s. The release now derives its length from what is left and how fast the finger was going, capped by the transition's own span, on the authored curve. The dim rides the same clock: `settleSeconds` reaches decorator swipe-end hooks, and `swipeSettleSeconds` is exported for transitions that want the same derivation.
