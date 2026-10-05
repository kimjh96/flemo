# Quickstart

## React

```tsx
import { FlemoDevtools } from "@flemo/devtools/react";

<FlemoDevtools />;
```

Render it unconditionally and leave it in the tree. Under the `production` export condition, the same import resolves to a component that renders nothing and imports nothing, so the recorder, panel and readout never reach the production bundle. No flag and no removal before release is needed.

Props: `recorder`, `hud` (`true`), `panel` (`true`), `hudPosition` (`"bottom-right"`), `panelPosition` (`"bottom-left"`), `initialOpen` (`false`), and `buckets` (`["A", "B"]`). `react` is an optional peer dependency required only for this entry.

Do not use `@flemo/devtools/force` to make the component appear in production. That import survives any guard around it and puts the real panel in a public chunk; this mistake happened twice on this project's site.

## Any framework

```ts
import { attachTransitionRecorder } from "@flemo/devtools";

const recorder = attachTransitionRecorder({ log: true });
// ...navigate...
const report = recorder.report(); // JSON-serializable FlemoReport
recorder.mark("A"); // label the transitions that follow, for a comparison
recorder.detach();
```

Read `report.verdict` first. It describes the session in plain sentences and does not summarise numbers from a session that cannot count as evidence.

Unless `installGlobal: false` or the name is already owned, the recorder installs `window.flemo`:

```js
copy(JSON.stringify(window.flemo.report(), null, 2));
```

With a plain unconditional `<FlemoDevtools />`, the recorder and its panels exist only in development builds, whose numbers the [judging protocol](judging.md) does not accept as evidence anyway. Production resolves to the inert entry, so nothing gets instrumented by accident and there is no flag to remember. The old `flemo:devtools` opt-in key is retired; a session that still has it reports it as a leftover key.

Calling `attachTransitionRecorder()` again while it is attached returns the same recorder, and during SSR it returns a handle that does nothing. To instrument a staging build or production-build E2E on purpose, see [production safety](production-safety.md).
