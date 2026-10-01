---
"@flemo/core": patch
---

Ask again for a morph's contents when the context that styles them changes. The remembered answer was keyed to the subtree alone, so a theme class on an ancestor or a stylesheet arriving with a lazy chunk could move a child and have the old answer reused, which is the one thing this rule is not allowed to do.
