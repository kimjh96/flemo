---
"@flemo/react": patch
---

Fix nested Router key collisions across nesting levels: a nested Router now chains its parent Router's key into its own history-state key. Previously two nesting levels both sitting on their root entries derived the same key, and the scope-persistence registry handed the inner Router the outer Router's stores, so one push navigated both levels at once.
