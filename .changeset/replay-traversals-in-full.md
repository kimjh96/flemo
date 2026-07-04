---
"@flemo/core": minor
---

Replay every queued back/forward traversal with its full transition — late but complete — restoring the pre-1.5.7 feel. Folding now happens only when this Router has rewritten the browser timeline since the event fired (a push truncated the forward stack, a replace swapped an entry): only then can a stale event reference a destroyed entry, which is the one case where replaying corrupts (proven by the convergence property test). A remounting Router also seeds with the present entry's identity instead of a generic root, so traversals back onto it match instead of being swallowed.
