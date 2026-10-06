# Scope promotion and SSR

The platform profile gates the scope's `will-change: transform` during the hold window and at rest on the top screen of a root Router. It supplies this decision for desktop Blink and the governed-compiled touch tier.

Every term is browser-only state, and the decision reaches the DOM as inline style. Read it through `useHydrationSafeFlag`, which uses `useSyncExternalStore` with a constant `false` server snapshot. Server and hydration renders therefore agree, and promotion arrives one commit later.

A screen mounted for push/pop/replace is not hydrating and reads the live value in its first render.

Any other browser-derived value reaching the DOM must use the same gate. Inline styles and attributes are compared during hydration; `suppressHydrationWarning` is not an option.
