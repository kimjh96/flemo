# React quickstart

```tsx
import { FlemoDevtools } from "@flemo/devtools/react";

<FlemoDevtools />;
```

Render it unconditionally and leave it in the tree. Under the `production` export condition, the same import resolves to a component that renders nothing and imports nothing. The recorder, panel, and readout never reach the production bundle; no flag or removal before release is needed.

Props: `recorder`, `hud` (`true`), `panel` (`true`), `hudPosition` (`"bottom-right"`), `panelPosition` (`"bottom-left"`), `initialOpen` (`false`), and `buckets` (`["A", "B"]`). `react` is an optional peer dependency required only for this entry.

Do not use `@flemo/devtools/force` to make the component appear in production. That import survives any guard around it and puts the real panel in a public chunk; this mistake happened twice on this project's site.
