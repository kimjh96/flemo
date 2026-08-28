---
"@flemo/core": patch
---

Carry each endpoint's scrollport clip into the flight as an animated inset, so an element half-hidden at a list's edge slides out from under the chrome stacked there and slides back beneath it on return, instead of painting whole over the tab bar from the first frame.
