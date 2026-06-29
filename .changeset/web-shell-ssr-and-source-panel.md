---
"@flemo/web": patch
---

Server-render the shell at the requested route (each page passes its initPath, nested Docs/Playground Routers seed from the matched slug/panel), removing the blank-frame flicker on load and the deep-link hydration mismatch. The playground source panel now stays mounted and slides open/closed via a CSS transition, so closing animates too.
