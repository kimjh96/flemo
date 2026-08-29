---
"@flemo/core": patch
"@flemo/react": patch
---

Fix a swipe-back inside a `history="memory"` Router leaving the stack unpopped. A memory Router now mounts the history sync like a browser one, so the gesture's commit reaches its stores; without it the dismissed screen stayed active off-stage and swallowed every tap that followed.
