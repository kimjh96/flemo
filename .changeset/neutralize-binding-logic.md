---
"@flemo/core": minor
"@flemo/react": patch
---

Move every framework-neutral piece of the React binding into `@flemo/core` so future bindings (Svelte, Solid) reuse it: `createStepController` (step push/replace/pop orchestration), `createRouterScope` (store-bundle creation/seeding, with the `FlemoStores` type), `buildRoutePath`, `matchesPathname`, `enteringInitialStyle`, `registerTransitionDefinitions`, `observeBarHeight`, and `observeViewportScrollHeight`. `@flemo/react` now delegates to them with no behavior change.
