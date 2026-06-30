---
"@flemo/web": patch
---

Remove the header theme-toggle icon flicker on first load. The selected theme is mirrored to a cookie, read server-side, and used to render the matching icon on first paint, so the mount gate (and its empty placeholder) is gone.
