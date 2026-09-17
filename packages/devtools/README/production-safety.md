# Production safety

Normal imports use `development` and `production` export conditions. The production implementation is inert and records nothing:

```ts
import { attachFlightRecorder } from "@flemo/devtools";
const { detach } = attachFlightRecorder({ log: true });
```

Vite and Next set these conditions. For bundlers that do not, guard a dynamic import with a build-time constant:

```ts
// Vite
if (import.meta.env.DEV) {
  const { attachFlightRecorder } = await import("@flemo/devtools");
  attachFlightRecorder({ log: true });
}

// Next.js / webpack
if (process.env.NODE_ENV !== "production") {
  const { attachFlightRecorder } = await import("@flemo/devtools");
  attachFlightRecorder({ log: true });
}
```

Install as a devDependency, but do not rely on dependency fields for bundle exclusion. A used top-level import can ship despite `"sideEffects": false` and no import-time effects. `dist/index.mjs` is self-contained; internal `process.env.NODE_ENV` substitution did not reduce measured esbuild bundles without an export condition.

Use the guarded import and verify production output lacks `present-pipeline pacing`. See `apps/web/app/[lang]/playground/_hooks/useDevtoolsRecorder`.

`@flemo/devtools/force` always loads the recorder. Import it dynamically behind an explicit opt-in only for staging or production-build E2E.
