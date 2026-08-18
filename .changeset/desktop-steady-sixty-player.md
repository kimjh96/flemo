---
"@flemo/core": minor
---

Add an in-flight display-cadence probe that verifies steady-60Hz desktop sessions. The first flights of a session measure the panel while a compositor animation is live (the only moment an adaptive 120Hz panel shows its true rate); two verified ~60Hz flights mark the session steady-60, and a single high-refresh reading latches it off permanently. Desktop Blink routing itself stays on the compiled compositor tier (the settled verdict of on-device judging), and the verdict instead arms desktop-profile defaults: the render-settle gate, the unpainted-only image hold, and the compositor warm-up. The settle gate's give-up path now also rides two consecutive fast frames before releasing, so a pop's returning screen, whose unfreeze re-uses its DOM and never trips the mount-commit detector, has its style/layout block absorbed into the hold instead of stuttering the flight's opening. Behavior at 1x density, on high-refresh panels, and on touch devices is unchanged.
