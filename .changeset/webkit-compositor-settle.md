---
"@flemo/core": patch
---

Settle a swipe release on the compositor. The motion after a gesture lets go was driven by a main-thread clock that stepped every settle frame — a trade inherited from the retired player, and the wrong one where the main thread is the scarce resource: on iOS in Low Power Mode the release stuttered along with the drag. It is now an ordinary CSS transition carrying the same authored duration and easing, on every engine, and the scrub clock is gone.
