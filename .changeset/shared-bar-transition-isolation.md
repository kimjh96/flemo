---
"flemo": minor
---

Isolate shared app and navigation bars from screen transitions. They now render outside the animated screen, so a transition's transform or opacity never affects them. When navigating to or from a screen that doesn't declare the same shared bar, the bar animates along with its own screen instead of staying pinned in place. Screen-level overlays that need to cover a shared bar should render in the browser top layer (`popover` / `<dialog>`).
