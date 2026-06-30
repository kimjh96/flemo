---
"@flemo/react": patch
"@flemo/core": patch
---

Fix useStep losing the screen's params in a keyed browser Router (a nested Router, or more than one Router on the page). pushStep/popStep and the step param restoration now go through the Router's own driver and self-pop guard, so closing a step (close button or browser Back) returns to the screen it was opened from instead of resetting to the first one. A deep-linked screen now seeds its params into the history frame too.
