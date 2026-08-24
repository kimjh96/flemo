---
"@flemo/web": patch
---

Make the playground a real playground and put it in the header. It is a peer screen of the shell now — Home, Showcase, Playground, Docs — so it arrives on the site's own shared-axis transition and its fixtures run nested inside a screen of another Router, which is the shape a consumer's app actually has. The bench offers every built-in preset plus four transitions authored the way a consumer writes them (`fade`, `raise`, `drift`, `sheet`), with the shared element on a SEPARATE switch: off, `shared`, or `zoom`. Two axes rather than pre-mixed cases, because a morph and a screen transition are separate systems that compose — turning the element off has to leave an ordinary transition behind, and it does. The fixture's screens also take the site's theme, which they never did: every screen inside the frames painted white, so the whole playground was unreadable in dark mode.
