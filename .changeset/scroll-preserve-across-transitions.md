---
"@flemo/react": patch
---

Preserve `scrollTop` of the screen's content area across push/pop transitions on mobile Safari. The screen scope's `will-change: transform` layer (added by the compiled transition rule) is demoted when the `animationend` rule stops matching, and iOS Safari resets nested scroll containers when their compositing context changes. The internal scroll container now declares `will-change: scroll-position` so it has its own layer that doesn't depend on the scope's promotion lifecycle. Unlike a transform-based layer hint, `scroll-position` does not create a containing block for fixed descendants, so consumer overlays (bottom sheets, dialogs) continue to anchor to the viewport.
