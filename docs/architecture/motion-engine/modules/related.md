# Related modules outside `engine/`

| Module | Responsibility |
| --- | --- |
| `screen/animStartAnchor.ts` | `animHoldKey`, `scheduleAnimHoldRelease`, decode readiness, render-settle gating, and `createAnimHoldCoordinator`. |
| `screen/pendingNetwork.ts` | Running request accounting that distinguishes loading from completed work without consumer declarations. |
| `transition/gestureScrub.ts` | Stages, scrubs, and settles paused gesture-driven animations for screens, bars, dim, and parts. |
| `transition/variantMotion.ts` | `resolveVariantMotion`: the single source for variant `{from, to, via, duration, delay, ease}` values. |
| `transition/resolveSwipeOptions.ts` | Resolves a transition's declared swipe and fills defaults so downstream code does not resolve them again. |
| `transition/animateInline.ts` | Inline leases and imperative swipe writes. |
| `transition/compileTransitionStyles.ts` | Keyframe compilation, promotion scoping, hold and arrival rules, and LPM `-lpm` flat-head keyframes using `LPM_HEAD_MS` 180/100/80 behind `:root[data-flemo-lpm]`. Uses only `translate3d`: 2D transforms pixel-snap-stutter on Blink. Timing must remain literal because `calc(var())` animation timing demotes WebKit fades to the main thread. |
| `transition/enteringInitialStyle.ts` | Inline `from` pose for the entering screen's first styled frame, subject to the PR #259 lease invariant. |
