---
"@flemo/core": patch
---

Remember whether a morph's contents hold across the mounts a navigation makes. The answer was cached against the arriving element, and an arrival is mounted for the navigation, so every transition laid a copy of the subtree out twice for an answer it already had. It is now keyed by what the answer depends on: the two sizes, the anchored corner, and the shape of the subtree read without touching layout.
