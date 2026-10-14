# Scope promotion and SSR

The supplied `ScreenMotion.tsx` does not import or call `useHydrationSafeFlag`, and does not explicitly assign `will-change: transform` to the scope. Its scope style combines layout and background properties, touch behavior, `initialStyle`, and finally `props.style`. A remaining promotion comment is not an executable style assignment. Imported style helpers and consumer styles were not supplied for this assessment, so this does not establish that the scope can never receive promotion.

The previous guidance described a platform-gated scope promotion during holds and at rest, using `useHydrationSafeFlag` with a constant `false` server snapshot. That mechanism is not present in the supplied component; do not describe it as current ScreenMotion wiring.

The hydration constraint remains relevant when introducing browser-derived DOM state: server and hydration renders must agree. A hydration-safe external-store flag can defer a browser-only decision until a later commit while allowing a newly mounted navigation screen to read live state. Inline styles and attributes are compared during hydration; `suppressHydrationWarning` is not a substitute for that agreement.

The current component resolves platform policy at each decision for park selection, atomic release, deferred reconciliation, and render settling. Those calls alone do not demonstrate hydration safety or platform defaults. See [holds and release](holds-and-release.md) for their binding behavior.
