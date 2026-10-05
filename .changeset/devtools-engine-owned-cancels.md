---
"@flemo/core": patch
"@flemo/devtools": patch
---

Stop reporting the engine's own head swaps and perceptual landing cuts as `animation-cancel` tripwires; a transition resolved early still trips. Core exports `HEAD_ANIMATION_SUFFIXES` so the recorder's copy stays pinned to it.
