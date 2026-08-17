---
"@flemo/core": minor
---

Route desktop Blink to the rAF player on verified steady-60Hz HiDPI displays. The first flights of a session keep the compiled tier while an in-flight cadence probe measures the panel with a compositor animation live (the only moment an adaptive 120Hz panel shows its true rate); two verified ~60Hz flights graduate the session to the player, whose per-frame device-pixel snap (now the desktop-Blink default) closes the compiled tier's HiDPI convergence shimmer and stepping. A single high-refresh reading latches the session back to compiled permanently, and the render-settle gate turns on for graduated sessions so the main-thread player is never born into the entering screen's mount commit. Desktop behavior at 1x density, on high-refresh panels, and on touch devices is unchanged.
