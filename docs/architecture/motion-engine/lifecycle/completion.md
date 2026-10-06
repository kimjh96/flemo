# Completion, landing clear, and layer settle

## Resolution

A clean end delays the COMPLETED flip by `landingClearFrames()` rAFs (`transitionRouting.ts`): one on Blink, which draws the last frame from the compositor, and four on WebKit, which presents from the main thread. A 100 ms background-tab fallback applies. The delay lets final motion reach the display before the busy completion commit; extra frames hold the finished picture still and end in the flip's repaint.

`resolveAfterChoreography` first waits the uncapped `choreographyExtraMs` for participants authored longer than the active screen. Recovery paths resolve immediately.

If the active screen's variant animates nothing—a morph camera carrying a still screen or a reveal-shaped exit on the passive side—there is no active `animationend`. The transition lands after every participant's animation finishes, followed by the same `landingClearFrames()`. `collectTransitionAnimations` collects the passive screen, transition parts, decorator, and camera.

The span timer armed at release (`participantSpanMs + 50`) is only a backstop for cancelled or lost animations. Landing on that timer held the finished picture for 40 to 70 ms on desktop Chrome.

## Cleanup and hold release

The COMPLETED effect force-clears inline residue on the scope, parts, and decorator. Bars use owner-scoped clearing because swipe and engine drivers share them. It then explicitly strips scope pose channels with `clearInlineAnimation(scope, ["transform", "opacity"])` so compiled rest rules own the landed scope.

Passive screens perform equivalent cleanup in their COMPLETED branch. The transition's teardown cleans a frozen previous screen: Activity freezes it in the same commit, preventing its COMPLETED effect.

`scheduleLanding` releases arrival, response, image, and transition-window holds together two rAFs after COMPLETED. Interruptions release immediately. A new navigation within this pending window first calls `landNow()`.

`layerSettleHold` keeps participant compositor promotions pinned until both `LAYER_SETTLE_MS` has elapsed after the flip and the transition window is idle, avoiding a full-viewport demotion repaint on convergence frames.
