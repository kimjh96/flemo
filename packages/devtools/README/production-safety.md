# Production safety

`@flemo/devtools` resolves through the `development` and `production` export conditions. The production build does nothing and records nothing:

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

Install it as a devDependency, but do not rely on that to exclude it from the bundle. A used top-level import still ships, even with `"sideEffects": false` and no import side effects. `dist/index.mjs` is self-contained; replacing `process.env.NODE_ENV` inside it did not shrink measured esbuild bundles without an export condition.

Use the guarded import, then verify that production output does not contain `present-pipeline pacing`.

In React, prefer the [`<FlemoDevtools />` component](quickstart.md), which needs no guard. This repository's site mounts it unconditionally in `apps/web/app/[lang]/_router/ShellRouter`; `apps/web/e2e/devtools-production.spec.ts` checks that no devtools surface reaches the production build.

`@flemo/devtools/force` always loads the real recorder. Import it dynamically behind an explicit opt-in, only for staging or production-build E2E.
