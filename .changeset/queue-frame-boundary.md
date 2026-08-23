---
"@flemo/core": patch
---

Hand the navigation queue over on a frame boundary. A queued navigation woke synchronously with the previous flight's terminal flip, so one binding commit unmounted the finished flight's screen and stamped the queued flight's opening together — a single frame carrying two flights' worth of style, layout and paint. A fast double back dropped a frame at exactly that seam.
