---
"@flemo/core": patch
---

Let a swipe's release settle run on the compositor on WebKit. It was driven by a main-thread clock that stepped every settle frame — a trade inherited from the retired player, and the wrong one where the main thread is the scarce resource: on iOS in Low Power Mode the release stuttered along with the drag. The authored duration and easing are unchanged; Blink keeps the scrubbed settle.
