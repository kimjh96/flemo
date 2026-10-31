# Scope promotion and SSR

The supplied `ScreenMotion.tsx` neither imports nor calls `useHydrationSafeFlag` and does not explicitly assign `will-change: transform` to the scope. Scope styles combine layout and background properties, touch behavior, `initialStyle`, then `props.style`. The remaining promotion comment is not an executable style assignment. Imported style helpers and consumer styles were not supplied, so this assessment does not establish that the scope can never receive promotion.

Previous guidance described platform-gated scope promotion during holds and at rest using `useHydrationSafeFlag` with a constant `false` server snapshot. That mechanism is absent from the supplied component and must not be described as current ScreenMotion wiring.

When introducing browser-derived DOM state, server and hydration renders must agree. A hydration-safe external-store flag can defer a browser-only decision until a later commit while allowing a newly mounted navigation screen to read live state. Hydration compares inline styles and attributes; `suppressHydrationWarning` does not replace that agreement.

The current component resolves platform policy at each decision for park selection, atomic release, deferred reconciliation, and render settling. These calls alone establish neither hydration safety nor platform defaults. See [holds and release](holds-and-release.md) for their binding behavior.
