# Production safety

The package resolves through the `development` and `production` export conditions. The production build does nothing and records nothing:

```ts
import { attachTransitionRecorder } from "@flemo/devtools";
const { detach } = attachTransitionRecorder({ log: true });
```

Vite and Next set these conditions. For bundlers that do not, guard a dynamic import with a build-time constant:

```ts
// Vite
if (import.meta.env.DEV) {
  const { attachTransitionRecorder } = await import("@flemo/devtools");
  attachTransitionRecorder({ log: true });
}

// Next.js / webpack
if (process.env.NODE_ENV !== "production") {
  const { attachTransitionRecorder } = await import("@flemo/devtools");
  attachTransitionRecorder({ log: true });
}
```

Install it as a devDependency, but do not count on that to keep it out of the bundle. A top-level import that is used still ships, even with `"sideEffects": false` and no side effects on import. `dist/index.mjs` is self-contained, and replacing `process.env.NODE_ENV` inside it did not shrink measured esbuild bundles without an export condition.

Use the guarded import, then check that the production output does not contain the string `present-pipeline pacing`. In React, prefer the [`<FlemoDevtools />` component](quickstart.md), which needs no guard: this repository's site mounts it unconditionally in `apps/web/app/[lang]/_router/ShellRouter`, and `apps/web/e2e/devtools-production.spec.ts` checks that no devtools surface reaches the production build.

`@flemo/devtools/force` always loads the real recorder. Import it dynamically, behind an explicit opt-in, and only for staging or production-build E2E.
