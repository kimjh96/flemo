---
"@flemo/core": minor
"@flemo/web": patch
---

Put the last two compositor-clocked motions on the player's clock. Swipe releases (the settle after a gesture lets go) now run as scrubbed single-keyframe Web Animations — the browser fills the start from the element's current position, exactly like the CSS transition they replace, while a shared main-thread clock steps every settling participant together; a new write to a settling element pins its current values first, so a re-grab takes over seamlessly. <Part> elements now join the navigation's shared player alongside their screen, bars, and dim, each with its own registered motion. Where WAAPI is unavailable the previous CSS paths remain byte-for-byte in charge, and settle frame gaps are deliberately excluded from the driver policy's demotion statistics (a release routinely overlaps the commit it triggers). The playground panel titles gain a "panel-title" Part demonstrating both.
