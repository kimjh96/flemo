---
"@flemo/react": minor
"@flemo/core": minor
"@flemo/web": patch
---

Start transitions against the screen shell: a screen mounting into a push or replace now renders its frame first and mounts consumer children in a deferred commit once the transition's first frame has painted, so heavy content can no longer freeze or swallow the animation. On Chromium, a transition whose entering screen defers its children now runs entirely on the compiled-CSS compositor for both screens instead of the rAF player, so the expected mid-flight commit can't starve the main thread and snap the motion — matching Safari's freeze-free behavior. The rAF player also re-anchors its clock across long main-thread stalls, resuming motion instead of fast-forwarding to the end. `@flemo/core` gains `shouldMountShellFirst` and `createMidFlightCommitLatch` exports so both decisions stay framework-neutral, new public API that lifts core to a minor bump.
