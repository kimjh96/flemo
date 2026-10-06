# Swipe wiring and event behavior

A stable core `createSwipeController` reads live render values through the latest-ref pattern, `swipeEnvRef`. Pointer handlers forward native events. An active `touchmove` listener prevents native scroll only after the controller claims a drag.

Recognition requires 8px of movement and a 3:1 primary-axis lead, preventing vertical scroll jitter from becoming page-wide horizontal back. `pointercancel` always settles without navigation.

PUSHING/REPLACING destinations remain hit-testable so a touch started during transition can scroll after landing.

Until the transition completes, the outer capture handler stops `click` before it reaches the target, suppressing both React handlers and native listeners on descendants of the React root. Listeners above the root (`document`/`window`) still observe the click.

Lower-level pointer/mouse events remain observable to preserve native scroll targeting. Consumers should commit navigation from `click`, not `pointerdown`/`pointerup`.
