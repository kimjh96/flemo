---
"@flemo/core": patch
---

Pair a morph even when the flip found nothing to snapshot. The departing side was measured only from the store's own subscriber at the moment of the flip, so a binding that re-renders synchronously inside that notification, or a screen whose morphs mount after it, left the arrival with no partner — and a pair that does not happen looks exactly like a screen transition with no morph in it. The arrival now measures its partner itself when the sweep missed it, in the same rest space the sweep would have recorded. Adds `flemo:morph=on`, an opt-in trace of every flight decision on `globalThis.flemoMorphTrace`, because a morph that declines is otherwise silent by design.
