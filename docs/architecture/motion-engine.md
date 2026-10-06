# The flemo motion engine

Map for coding agents changing `packages/core/src/core/engine/`. Module header comments remain authoritative for device history.

Every transition uses compiled compositor CSS. `compileTransitionStyles.ts` produces `@keyframes` and variant rules injected by the React binding through `useTransitionStyles`, matching `data-flemo-status`, `data-flemo-active`, and `data-flemo-transition`. Browser animation is compositor-driven on Blink and main-thread-presented on WebKit.

The rAF motion player, scrub-WAAPI sub-tier, and routing between them were retired in 2026-08. `@flemo/devtools` still labels transitions `inline` when it detects per-frame inline screen writes; this now indicates something outside the library is writing frames onto a screen. Routing determines the transition's opening and whether the engine may touch its clock.

## Engine contracts

- [Transition lifecycle](./motion-engine/lifecycle.md): hold, release, transition protection, perceptual cut, completion, and landing.
- [Inline leases](./motion-engine/inline-leases.md): ownership, restoration, and the PR #259 invariant.
- [Module inventory](./motion-engine/modules.md): engine and related module responsibilities.
- [Single-resolution contract](./motion-engine/resolution.md): completion paths and stale-task protection.

Companions: [transition routing](./driver-routing.md), [diagnostics](../instructions/diagnostics.md), and the [motion-jank postmortem](../instructions/motion-jank-postmortem.md).
