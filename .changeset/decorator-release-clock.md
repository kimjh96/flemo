---
"@flemo/core": patch
---

Land a decorator's swipe release with the screens rather than ahead of them. A decorator's release now borrows the screens' authored span for the gesture scaling, so a swipe-completed pop holds the dim to the screen exactly as a button-driven one does; a handler's explicit `duration: 0` is still a snap, and a `<Part>` keeps its own span because it has no screen clock to take.
