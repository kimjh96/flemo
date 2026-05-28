---
"@flemo/core": patch
---

Hold `overlay`'s `backgroundColor` static at the target dim across every variant so only `opacity` is keyframe-animated. Effective dim is now `opacity × 0.3` (linear) instead of the previous `opacity × bg_alpha` product (which produced ≈0.075 at midpoint — barely visible — and jumped to 0.3 only at the very end). The keyframe is also single-property, which avoids iOS Safari's known color-space interpolation quirks for `background-color` under a transformed ancestor and shrinks the `will-change` hint to `opacity` alone.
