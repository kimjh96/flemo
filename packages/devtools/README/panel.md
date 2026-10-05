# Visual panel

```ts
import { attachDevtoolsPanel } from "@flemo/devtools";
const panel = attachDevtoolsPanel();
// panel.detach();
```

Attach the panel only behind a development-only flag; flemo and its playground never attach or ship it on their own. The floating toggle shows how many transitions were recorded and a dot when any has an anomaly. The drawer lists the transitions, their details, active overrides and blind spots.

Options: `recorder`, `initialOpen` (`false`), `position` (`"bottom-right"` or `"bottom-left"`) and `buckets` (`["A", "B"]`). Without `recorder`, the panel reuses this package's `window.flemo` or creates its own recorder. Attaching it again while it is mounted does nothing, and without a DOM it does nothing.

The header starts with the verdict and every failed precondition. Its A/B button labels the next transitions for a comparison.

The panel uses no framework and renders into an open shadow root. Its host is fixed and zero-sized, carries `data-flemo-devtools-panel` and none of the screen `data-flemo-*` attributes, so it never takes part in a transition. The drawer height is kept in `sessionStorage` as `flemo:devtools-panel-height`.

The panel must not redraw while a transition runs:

- It refreshes through a `setTimeout` chain, about three times per second while open and once every two seconds while closed, and never runs a `requestAnimationFrame` loop.
- It skips a refresh or a deferred action while any screen has a transitional `data-flemo-status`, and retries on the next tick.
- It renders only the toggle while closed.
- It has no CSS transitions, keyframes or live-dashboard behaviour.
