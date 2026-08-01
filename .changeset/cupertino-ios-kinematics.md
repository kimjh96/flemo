---
"@flemo/core": patch
---

Align the cupertino preset's kinematics with the measured native iOS navigation transition — 30% parallax on the covered screen (was 35%) and a 10% dim (was 20%) — and lengthen the glide to 0.7s (was 0.6s) on the same UIKit-spring bezier. The perceptual analyzers now ignore channels held constant across a variant, so a constant decoration never disables the completion cut.
