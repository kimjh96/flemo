---
"@flemo/core": minor
"@flemo/react": patch
---

Release the anim-hold straight onto the DOM on desktop macOS Safari, the way
touch WebKit already does. That session runs a compiled animation whose clock
WebKit presents from the main thread, so letting React's render and commit work
sit between the clock's start and the released attribute cost it the front of
every transition. `flemo:deskflip=off` restores the previous path.
