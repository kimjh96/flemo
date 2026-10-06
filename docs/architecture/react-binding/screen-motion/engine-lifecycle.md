# Engine lifecycle and subscriptions

Create one `createTransitionEngine` per screen, lazily through a ref. Its minimal dependencies are a task id getter and two store setters.

Call `driveScreenLifecycle` from `useLayoutEffect` with `[status, isActive, transitionName, prevTransitionName, animHold]`. Releasing anim-hold reruns the effect so the compiled animation can start.

Only the top screen and the screen beneath it (`participatesInTransition`) subscribe to live status. Resting screens pin status to `"COMPLETED"`, keeping navigation re-renders O(1) rather than O(depth).
