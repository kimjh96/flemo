---
"@flemo/core": patch
"@flemo/react": patch
---

Keep the screen and the URL in lockstep under rapid back/forward traversals across a nested Router boundary. A traversal task whose Router unmounted before it ran now aborts instead of deadlocking the shared navigation queue; a nested Router derives its history-state key from its enclosing screen's entry id so a remount can read the frames its previous incarnation wrote; a traversal that cannot be faithfully classified adopts the entry without a transition instead of ignoring it; and a remounted Router no longer renames a history entry the browser had already moved past.
