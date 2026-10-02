# Completion, landing clear, and layer settle

## Resolution

A clean end delays the COMPLETED flip by `landingClearFrames()` rAFs (`flightRouting.ts`): one on Blink, which draws the last frame from the compositor; four on WebKit, which presents from the main thread. A 100 ms background-tab fallback applies. This lets final motion reach the display before the busy completion commit. Extra frames hold the finished picture still and end in the flip's repaint.

`resolveAfterChoreography` first waits the uncapped `choreographyExtraMs` for any participant authored longer than the active screen. Recovery paths resolve immediately.

When the active screen's own variant animates nothing—a morph camera carrying a still screen, or a reveal-shaped exit on the passive side—there is no active `animationend` to resolve on. The flight lands when every participant's animation has finished, followed by the same `landingClearFrames()`. `collectFlightAnimations` collects the passive screen, the flight's parts, the decorator, and the camera.

The span timer armed at release (`participantSpanMs + 50`) is only the backstop for a cancelled or lost animation. Landing on that timer held the finished picture for 40 to 70 ms on desktop Chrome.

## Cleanup and hold release

The COMPLETED effect force-clears inline residue on the scope, parts, and decorator. Bars use owner-scoped clearing because swipe and engine drivers share them. It then strips scope pose channels explicitly with `clearInlineAnimation(scope, ["transform", "opacity"])`, ensuring compiled rest rules own the landed scope.

Passive screens perform equivalent cleanup in their COMPLETED branch. A frozen previous screen is cleaned by the flight's own teardown because Activity freezes it in the same commit, preventing its COMPLETED effect.

`scheduleLanding` releases arrival, response, image, and flight-window holds together two rAFs after COMPLETED. Interruptions release immediately. A new navigation inside this pending window first calls `landNow()`.

`layerSettleHold` keeps participant compositor promotions pinned until `LAYER_SETTLE_MS` after the flip and until the flight window is idle, avoiding a full-viewport demotion repaint on convergence frames.
