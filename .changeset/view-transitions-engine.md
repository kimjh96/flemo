---
"@flemo/core": minor
"@flemo/react": minor
---

Route transitions that animate non-compositable properties (filter, clip-path, background, ...) through the View Transitions API, so they stay smooth under heavy main-thread work; transform/opacity transitions keep the compositor-driven CSS path. Also extracts the transition lifecycle and swipe-back gesture into a framework-neutral engine in @flemo/core. Routing is automatic — no public API change.
