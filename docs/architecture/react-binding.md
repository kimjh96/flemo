# @flemo/react architecture

`@flemo/react` binds React to `@flemo/core`. Core owns imperative, reusable behavior: task queues, stores, the engine, compiled styles, and gesture math. This package renders the declarative state (data attributes and inline styles) the engine reads and calls core at React lifecycle boundaries.

## Design map

- [Router](./react-binding/router.md): stores, history, scope targeting, publication timing, hydration, and lifetime.
- [ScreenMotion](./react-binding/screen-motion.md): engine lifecycle, holds, swipes, bars, styles, and layer promotion.
- [Screen and freeze](./react-binding/screen-freeze.md): Activity lifetime, deferred freezing, and bar registration.
- [Rendering, parts, morphs, and hooks](./react-binding/rendering.md): stack rendering, outer Parts, shared elements, and scope coordination.

## Ownership and protocol

Core's `startFlemoRuntime()` owns AMBIENT machinery: GPU prewarm and image-decode offload. Neither is React-specific; another binding must not have to reimplement them. A Router starts the runtime on mount and releases it on unmount; choosing that lifetime is the binding's responsibility.

Core's `resolvePlatformProfile()` supplies every browser-specific decision as a named field. The binding asks and renders; it performs no engine probes. A grep for `detectBlinkEngine()` in `src/` returns nothing and must continue to do so. Pass whether the transition authored `driver: "native"`, which core cannot see. Resolve the profile per decision; hoisting a profile prevents DevTools toggles from taking effect.

`data-flemo-*` attributes form the DOM PROTOCOL, declared in core's `src/dom/attributes.ts`. Core's `dom/__tests__/attributes.test.ts` rejects raw attribute literals in core; this package's `screen/__tests__/domProtocol.test.tsx` rejects rendered attributes absent from core's table. Import constants for imperative reads/writes. JSX prop names remain literal because they cannot be symbols; the render test validates them.

Engine internals are documented in `createTransitionEngine.ts` (`driveScreenLifecycle` describes the flight) and `diagnosticFlags.ts` (the flag registry table, checked against shipped readers by `documentedDefaults.test.ts`). The tracked engine architecture map, `packages/core/docs/motion-engine.md`, is tested against the code. The maintainer's untracked `docs/` campaign notes are excluded via .gitignore; shipped source cites none of them. The public surface consists only of `src/index.ts` re-exports.

## Implementation and validation rules

- Path aliases: `@history`, `@navigate`, `@renderer`, `@screen`, `@stores`, `@transition`, `@utils`, `@Route`, `@Router`. Import core through named imports from `@flemo/core` only.
- Compute anything the engine needs in the first paint of a state change during render, never in an effect: hold attributes, riding flags, and freeze tracking refs.
- Tests live beside source in `__tests__/`. jsdom reports an empty platform and no touch, taking the ungoverned path with no head; see [flight routing](./driver-routing.md).
