---
"@flemo/react": patch
---

Stop painting a covered screen in the commit it is covered, on every platform. A freeze does two things — the screen stops painting, and the screen is released (effects unmounted, boxes dropped, raster let go) — and they were one commit, so the delay the expensive half needs was also delaying the cheap one. A covered screen went on painting until it was released: 600ms for the screen a pop can return to, and on desktop Blink three seconds on top of that. Nothing above a screen is obliged to be opaque, so that was a stack showing through itself for the whole wait. Paint now stops immediately and uniformly; the release keeps its clock, and a deep screen — never what a pop wakes — is released at once everywhere instead of waiting out a debounce that exists for a round trip it cannot be part of.
