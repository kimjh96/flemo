# On-device readout

```ts
import { attachDevtoolsHud } from "@flemo/devtools";
const hud = attachDevtoolsHud({ position: "bottom-right" });
// hud.detach();
```

On a phone without a console, the readout shows one high-contrast monospaced line that stays readable in a photo of the device:

```
POP 412ms  gap 33.4  drop 1  !2
```

That is the navigation kind and duration of the last transition, its longest frame gap in milliseconds after the hold was released, the number of frames longer than 30 ms, and the number of anomalies (`ok` when there are none).

Tap for details: frames, motion, holds, shared elements, how the animation was driven, and the anomalies of the last transition. Long-press to switch the comparison bucket. The pill next to it collapses the readout to the pill and brings it back, so it stays off the screen without being unmounted. That choice lasts for the session, and polling stops while it is hidden.

Options:

- `recorder`
- `position`: any corner, `"bottom-right"` by default, or a centered `"top"` or `"bottom"` strip
- `initialExpanded`: `false`
- `initialHidden`: the session's last choice
- `buckets`: `["A", "B"]`

Like the panel, it redraws only between transitions. Its stylesheet has no transitions or keyframes, and its fixed, zero-sized host never takes part in a transition.
