---
"@flemo/core": minor
"@flemo/react": minor
---

Add `useKeyboardInset()` (and `observeKeyboardInset` in core): how many pixels of the layout viewport the software keyboard covers, which is the offset a `position: fixed` element needs to sit on the keyboard instead of behind it. It counts the visual viewport sliding as well as shrinking, reads 0 while pinch-zoomed, and hands its current value to a screen waking from freeze.
