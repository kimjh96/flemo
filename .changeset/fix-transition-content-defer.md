---
"@flemo/react": patch
---

Keep a screen transition running as defined when the entering screen fetches or renders heavy content. The animation now starts on a light first commit, with the screen's content filling in on the next, so a cold first visit (lazy chunk, fetch, large DOM) no longer delays or stutters the transition. Most visible on iOS Safari.
