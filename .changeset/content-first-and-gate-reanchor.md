---
"@flemo/react": patch
"@flemo/core": patch
"@flemo/web": patch
---

Revert the shell-first children deferral and re-anchor the transition gate to the motion start. Screens enter with their real content in the first frame again — no blank shell, no late content pop-in, no perceived double render. A heavy mount commit now delays the transition start by exactly its cost instead of snapping the transition away: the gate backstop re-arms while the hold is pending and restarts with a full window when the motion actually begins.
