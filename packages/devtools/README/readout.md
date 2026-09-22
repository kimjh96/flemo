# On-device readout

```ts
import { attachDevtoolsHud } from "@flemo/devtools";
const hud = attachDevtoolsHud({ position: "bottom-right" });
// hud.detach();
```

For phones without a console, the readout provides one high-contrast monospaced line readable in a device photograph:

```
POP 412ms  gap 33.4  drop 1  !2
```

Tap for details: frames, motion, holds, shared elements, navigation driver, and flight anomalies. Long-press to cycle the comparison bucket. The adjacent pill hides the readout down to the pill and restores it, keeping instruments off the screen without unmounting them. This choice persists for the session; polling stops while hidden.

Options:

- `recorder`
- `position`: any corner, default `"bottom-right"`, or centered `"top"` and `"bottom"` strips
- `initialExpanded`: `false`
- `initialHidden`: the session's last choice
- `buckets`: `["A", "B"]`

Like the panel, it repaints only between flights. Its stylesheet has no transition or keyframe, and its fixed, zero-sized host cannot join a flight.
