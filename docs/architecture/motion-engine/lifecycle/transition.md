# Release and transition

When `animHoldReleased` becomes true, the engine effect reruns and the compiled animation starts.

From the first transitional commit, rather than release, the engine arms cold-side protection for the push/replace entrant or returning pop screen:

- `arrivalHold`: a `MutationObserver` hides mid-transition swaps and additions through `[data-flemo-held-arrival] { display: none !important }`, then reflects them in one rest commit. Early arming is necessary because a release-frame commit can age the compiled clock.
- `invisibleAnimationHold`: pauses invisible consumer animations, including culled skeleton shimmer subtrees whose first composite can stall presentation.
- `responseHold`: patches `window.fetch` to park mid-transition response resolutions for every method except streams, then releases them as one rest batch. Its backstop is the full choreography span plus 1500 ms.
- `beginTransitionWindow`: exposes a global latch so out-of-engine systems, including the image-decode offloader, defer reveals until rest.

`stampAsyncImageDecode` runs for every active or passive participant before any early-return branch. `holdParticipantLayers` pins compiled `will-change` and `contain` promotions inline for the transition and stamps desktop-Blink governed landing easing.

Compiled Blink transitions also start a lazy, session-persistent no-op rAF frame-pacing keepalive and the display-interval probe: Chrome on macOS ProMotion presents unevenly when the main thread is idle.
