# Scope targeting and publication

Through `RouterScopeContext` and `RouterTarget.ts`, each Router publishes a `RouterScopeNode` containing `name`, `stores`, `routePaths`, `strictRoutes`, and `parent`. `useNavigate` can target beyond the nearest Router with `router: "current" | "parent" | "root" | "nearest-owner" | "<name>"`. Use `{ name }` or `{ scope }` when a name collides with a keyword.

`RegisterRouter` augmentation controls accepted navigation names. An empty registry permits any string; a non-empty registry restricts names to `keyof RegisterRouter`, making typos compile errors. The `@ts-expect-error` block in `useNavigate.routerTarget.test.tsx` guards this narrowing: tsc reports an unused directive if it regresses. The Router `name` prop remains `string`, analogous to `<Route path>` versus `push()`.

## Publication timing

Create the node identity once and refresh it in place so the extra provider causes zero re-renders. Refresh through `publishRouterConfig` in an insertion effect:

- Never publish during render: discarded or suspended renders could publish props that no visible screen committed to.
- Publish before the entire layout pass: layout effects run bottom-up, so a descendant redirect in a layout effect would otherwise read the previous commit's configuration.

`defaultTransitionName` has the same discarded-render hazard but publishes in the layout phase. Its store write notifies subscribers, and React forbids scheduling updates from an insertion effect. Write only on an actual change: zustand compares the partial by identity, so an unguarded write wakes every subscriber on every commit. Regression tests cover all three windows.

## Target resolution and diagnostics

Resolve targets purely and synchronously before queuing any task. The selected scope's stores, driver, `markSelfInduced`, and `life` execute the entire navigation. Development errors therefore reach the caller's stack rather than becoming unhandled rejections.

Check route ownership (`ownsRoute`) for each navigation. An explicit target produces a development throw; an implicit target produces a development warning, preserving legacy behavior unless `strictRoutes` applies. Diagnostics use `@utils/devDiagnostics`, gated on `process.env.NODE_ENV`; vite.config.mts deliberately does not fold that value during the library build.
