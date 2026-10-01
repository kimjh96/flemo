# Quickstart

## React

```tsx
import { FlemoDevtools } from "@flemo/devtools/react";

<FlemoDevtools />;
```

Render it unconditionally and leave it in the tree. Under the `production` export condition, the same specifier resolves to a component that renders null and imports nothing: recorder, panel, and readout never enter the production graph. No flag or release-time removal is needed.

Props: `recorder`, `hud` (`true`), `panel` (`true`), `hudPosition` (`"bottom-right"`), `panelPosition` (`"bottom-left"`), `initialOpen` (`false`), and `buckets` (`["A", "B"]`). `react` is an optional peer dependency required only for this entry.

Do not use `@flemo/devtools/force` to make the component appear in production. The specifier survives guards wrapped around it and puts the real panel in a public chunk; this mistake was measured twice on this project's site.

## Any framework

```ts
import { attachFlightRecorder } from "@flemo/devtools";

const recorder = attachFlightRecorder({ log: true });
// ...navigate...
const report = recorder.report(); // JSON-serializable FlemoReport
recorder.mark("A"); // label the flights that follow, for a comparison
recorder.detach();
```

Read `report.verdict` first: the recorder describes the session in plain sentences and refuses to summarize data from a session that could not produce evidence.

Unless `installGlobal: false` or the name is already owned, the recorder installs `window.flemo`:

```js
copy(JSON.stringify(window.flemo.report(), null, 2));
```

Ordinary unconditional `<FlemoDevtools />` wiring makes the recorder and its surfaces available only in builds whose numbers the [judging protocol](judging.md) rejects. Production resolves to the inert entry, preventing accidental instrumentation without a remembered flag. The former query opt-in `flemo:devtools` is retired; sessions carrying it report residue.

`attachFlightRecorder()` is idempotent while attached and returns an inert handle during SSR. See [production safety](production-safety.md) for controlled staging or production-build E2E instrumentation.
