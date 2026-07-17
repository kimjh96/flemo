---
"@flemo/react": minor
"@flemo/core": patch
"@flemo/web": patch
---

Start transitions against the screen shell: a screen mounting into a navigation now renders its frame first and mounts children in a deferred commit after the transition has started, so heavy content can no longer freeze or swallow the animation. The rAF player also re-anchors its clock across long main-thread stalls, resuming motion instead of fast-forwarding to the end.
