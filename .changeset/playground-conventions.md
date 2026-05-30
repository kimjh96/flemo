---
"@flemo/web": patch
---

Tidy the playground to match the workspace conventions: add the missing `"use client"` directive to the interactive segment/toggle/transition-picker components, drop decorative box-shadows in favor of the 1px-border design-system rule, move the bottom-sheet scrim and phone-frame ring onto theme tokens, and return `albumById` as `Album | null`.

Move the performance/benchmark controls out of the in-app Library screen into a dedicated card in the developer panel, so the music app preview (and the embedded landing hero) stays free of developer buttons.
