---
"@flemo/react": minor
"@flemo/core": minor
"@flemo/web": patch
---

Start transitions against the screen shell: a screen mounting into a push or replace now renders its frame first and mounts consumer children in a deferred commit once the transition's first frame has painted, so heavy content can no longer freeze or swallow the animation. The rAF player also re-anchors its clock across long main-thread stalls, resuming motion instead of fast-forwarding to the end. `@flemo/core` gains a `shouldMountShellFirst` export so the shell-first decision stays framework-neutral, a new public API that lifts core to a minor bump.
