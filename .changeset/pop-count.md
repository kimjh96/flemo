---
"@flemo/core": minor
"@flemo/react": minor
"@flemo/web": patch
---

`useNavigate().pop(count)` now pops multiple screens in a single transition — the leaving top animates out, the screen `count` entries back animates in, and the screens in between are removed without ever painting. `count` clamps to the available depth (so popping past the root lands on the root), and `pop()` / `pop(1)` are unchanged.

Adds `useNavigate().popTo(path)`, which pops back to the nearest screen below the top whose route matches `path` (e.g. `popTo("/album/:id")`), skipping the screens in between in that same single transition. No match is a no-op.
