---
"@flemo/core": patch
"@flemo/react": patch
---

Fix a swipe-back inside a `history="memory"` Router leaving the stack unpopped. The gesture committed straight to the history driver, which a memory Router has no listener for, so the dismissed screen stayed active off-stage and swallowed every tap that followed.
