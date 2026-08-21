---
"@flemo/core": minor
"@flemo/react": patch
---

Stop a screen scope from staying a compositor layer at rest. A promotion is also a stacking context, so a scope that kept one outlived its flight and silently outranked anything a consumer rendered inside the screen — an open bottom sheet came up under the shared tab bar and no z-index could answer it. Flight-time promotion is unchanged; it belongs to the engine, which demotes it a settle past the landing. `flemo:preraster=on` re-arms the rest promotion and `flemo:layers=resident` the resident layers, both now opt-in.
