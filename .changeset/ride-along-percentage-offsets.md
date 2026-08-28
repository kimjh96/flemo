---
"@flemo/core": patch
"@flemo/react": patch
---

Fix a shared bar travelling the wrong distance under a vertical transition. A riding bar runs the screen's keyframes on its own box, so a percentage offset resolved against the bar's height instead of the screen's: a material push moved a 104px bar 104px while its 770px screen moved 770px, landing the bar alone at the top of a screen still off the bottom of the viewport. The bar now runs a copy of the keyframes measured against the screen box, and a swipe release resolves the same offset the same way. Horizontal transitions are unchanged, because a shared bar is already exactly as wide as its screen.
