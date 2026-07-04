---
"@flemo/core": minor
"@flemo/react": patch
---

Make history synchronization identity-based and convergent, fixing the duplicate-screen crash and skipped transitions under rapid back/forward. Traversals now classify by entry identity (entries we hold pop with their animation, gap jumps included) with browser-space frame stamps for direction; queued events coalesce to the browser's present entry so storms collapse into one converging transition; and queued in-app navigations align the stack to the entry the user actually saw (and abort entirely when their Router has since unmounted) before acting. Verified by a randomized convergence property test against a browser-history model.
