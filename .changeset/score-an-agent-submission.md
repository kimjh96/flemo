---
"@flemo/web": patch
---

Score an agent submission's production build against the registered rubric, reading only the eleven `data-eval` roles the task prompts require and the `data-flemo-*` attributes the engine already publishes. A self-test runs every criterion against one real application twice, untouched and with the defect its own sentence names, so a rubric that cannot separate the two fails before it scores anyone.
