# Visual panel

```ts
import { attachDevtoolsPanel } from "@flemo/devtools";
const panel = attachDevtoolsPanel();
// panel.detach();
```

Consumers must opt in behind a development-only flag; flemo and its playground neither attach nor ship the panel automatically. The floating toggle shows flight count and an anomaly dot. The drawer shows flights, details, active overrides, and blind spots.

Options: `recorder`, `initialOpen` (`false`), `position` (`"bottom-right"` or `"bottom-left"`), and `buckets` (`["A", "B"]`). Without `recorder`, the panel reuses this package's `window.flemo` or owns a new recorder. It is idempotent while mounted and inert without a DOM.

The header leads with the verdict and every failed precondition. Its A/B button arms comparison buckets.

The framework-free panel uses an open shadow root. Its fixed, zero-sized host has `data-flemo-devtools-panel`, no screen `data-flemo-*` attributes, and cannot join a flight. Drawer height persists as `flemo:devtools-panel-height` in `sessionStorage`.

The panel must not repaint during a flight:

- Refresh through a `setTimeout` chain about three times per second while open and once every two seconds while closed; never maintain an rAF loop.
- Skip refreshes and deferred actions while any screen has transitional `data-flemo-status`; retry next tick.
- Render only the toggle while closed.
- Add no CSS transitions, keyframes, or live-dashboard behavior.
