---
"@flemo/web": patch
---

Polish the playground "View source" panel: the code now scrolls inside its
rounded frame (so the scrollbar no longer squares off the corners), reserves the
floating control dock's height instead of hiding the last lines behind it, and
drops the leading `"use client"` directive from the displayed source.
