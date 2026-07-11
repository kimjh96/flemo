---
"@flemo/core": minor
---

Scope the motion-driver default to the rendering engine. The compositor defect the rAF player routes around was measured on Blink specifically, while a main-thread player starves WebKit's weaker mobile main threads (eye-confirmed janky on Safari, worst on iOS) whose compositor never had the defect. The player now defaults on only for Blink; WebKit and other engines keep the compiled compositor paths (CSS animations for transitions, CSS transitions for swipe settles) that served them before. The measured demotion policy and the diagnostic force key remain supreme on every engine, and nothing changes for Chromium users.
