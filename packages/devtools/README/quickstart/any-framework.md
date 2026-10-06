# Any framework quickstart

```ts
import { attachTransitionRecorder } from "@flemo/devtools";

const recorder = attachTransitionRecorder({ log: true });
// ...navigate...
const report = recorder.report(); // JSON-serializable FlemoReport
recorder.mark("A"); // label the transitions that follow, for a comparison
recorder.detach();
```

Read `report.verdict` first. It describes the session in plain sentences and does not summarize numbers from a session that cannot count as evidence.

Unless `installGlobal: false` or the name is already owned, the recorder installs `window.flemo`:

```js
copy(JSON.stringify(window.flemo.report(), null, 2));
```

Calling `attachTransitionRecorder()` while already attached returns the same recorder. During SSR, it returns a handle that does nothing.

See the [judging protocol](../judging.md) for evidence requirements and [production safety](../production-safety.md) for intentional instrumentation of staging builds or production-build E2E.
