# On-device readout

```ts
import { attachDevtoolsHud } from "@flemo/devtools";
const hud = attachDevtoolsHud({ position: "bottom-right" });
// hud.detach();
```

On phones without a console, the readout displays a high-contrast monospaced line readable in a device photo:

```
POP 412ms  gap 33.4  drop 1  !2
```

The line shows the last transition's navigation kind and duration, longest frame gap in milliseconds after hold release, count of frames longer than 30 ms, and anomaly count (`ok` when none).

Tap for the last transition's frames, motion, holds, shared elements, animation driver, and anomalies. Long-press to switch comparison buckets. The adjacent pill collapses the readout to the pill and restores it without unmounting. This choice persists for the session; polling stops while hidden.

Options:

- `recorder`
- `position`: any corner (default: `"bottom-right"`) or a centered `"top"` or `"bottom"` strip
- `initialExpanded`: `false`
- `initialHidden`: the session's last choice
- `buckets`: `["A", "B"]`

Like the panel, the readout redraws only between transitions. Its stylesheet has no transitions or keyframes. Its fixed, zero-sized host never participates in a transition.
