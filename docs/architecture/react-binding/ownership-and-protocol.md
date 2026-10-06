# Ownership and protocol

Core's `startFlemoRuntime()` owns AMBIENT machinery: GPU prewarm and image-decode offload. Neither is React-specific; other bindings must not need to reimplement them. A Router starts the runtime on mount and releases it on unmount. The binding chooses this lifetime.

Core's `resolvePlatformProfile()` supplies every browser-specific decision as a named field. The binding asks and renders without engine probes. A grep for `detectBlinkEngine()` in `src/` must continue to return nothing. Pass whether the transition authored `driver: "native"`, which core cannot see. Resolve the profile per decision: hoisting it prevents DevTools toggles from taking effect.

`data-flemo-*` attributes form the DOM PROTOCOL declared in core's `src/dom/attributes.ts`. Core's `dom/__tests__/attributes.test.ts` rejects raw attribute literals in core; this package's `screen/__tests__/domProtocol.test.tsx` rejects rendered attributes absent from core's table. Import constants for imperative reads and writes. JSX prop names remain literal because they cannot be symbols; the render test validates them.

Engine internals are documented in `createTransitionEngine.ts`, where `driveScreenLifecycle` describes the transition, and `diagnosticFlags.ts`, whose flag registry table is checked against shipped readers by `documentedDefaults.test.ts`. The tracked architecture map, `packages/core/docs/motion-engine.md`, is tested against code. The maintainer's untracked `docs/` campaign notes are excluded via .gitignore; shipped source cites none of them. The public surface consists only of `src/index.ts` re-exports.
