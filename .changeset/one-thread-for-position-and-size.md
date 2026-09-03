---
"@flemo/core": patch
---

Drive a flight's position through registered properties, so it stays on the thread its size is on. WebKit runs a `translate` on the compositor even where the same keyframe animates a `width`, which left a line of type's position running ahead of its own size and reading as the text arriving late. Where the properties cannot be registered the position goes back to `left` and `top`.
