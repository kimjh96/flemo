---
"@flemo/core": patch
"@flemo/react": patch
---

Stop a swipe gesture from surviving the pointer that started it. While a drag is armed the screen suppresses native touch scrolling, and that flag could only be cleared by a pointerup carrying the id that armed it — so when the browser never delivered one (Safari drops the remaining pointer events when the element holding capture is removed or hidden), the screen stopped scrolling for good, and the next press could not recover it either. A gesture now also ends on `lostpointercapture`, on the next primary press, and when the screen unmounts or freezes underneath it.
