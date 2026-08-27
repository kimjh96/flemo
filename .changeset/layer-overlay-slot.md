---
"@flemo/core": minor
"@flemo/react": minor
---

Add `<Layer>`, which renders a consumer overlay beside its screen so it can cover the shared bars while the screen is moving. The overlay leaves the screen for paint order only: it stacks by its owning screen, runs that screen's keyframes so it travels and leaves with it, and stops painting when that screen is covered. Screens now state their internal paint order (content under chrome, chrome under an overlay, the dim over all three) instead of inferring it from element order.
