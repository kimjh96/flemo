---
"@flemo/web": patch
---

Hand the composition card's eyebrow and summary over beside its shared box instead of inside it, and space them with padding rather than a margin on the Part's child. Two different sentences carried by one Morph had to be cut to 0.13s of a 0.7s transition so they would not print over each other, which read as the copy switching off and the card travelling empty; a margin inside a Part does not collapse while the screen is moving and does once it settles, which dropped the summary 12px some 60ms after the card had landed.
