# Visual panel

```ts
import { attachDevtoolsPanel } from "@flemo/devtools";
const panel = attachDevtoolsPanel();
// panel.detach();
```

Attach the panel only behind a development-only flag. flemo and its playground never attach or ship it on their own.

The floating toggle shows the recorded transition count and a dot if any transition has an anomaly. The drawer lists transitions, their details, active overrides and blind spots. The header starts with the verdict and every failed precondition; its A/B button labels the next transitions for comparison.

## Options and attachment

Options are `recorder`, `initialOpen` (default `false`), `position` (`"bottom-right"` or `"bottom-left"`) and `buckets` (default `["A", "B"]`). Without `recorder`, the panel reuses this package's `window.flemo` or creates its own recorder. Attaching it again while mounted does nothing. Without a DOM, attachment does nothing.

## Rendering contract

The panel uses no framework and renders into an open shadow root. Its fixed, zero-sized host carries `data-flemo-devtools-panel` and none of the screen `data-flemo-*` attributes, so it never participates in a transition. Drawer height is stored in `sessionStorage` as `flemo:devtools-panel-height`.

The panel must not redraw while a transition runs:

- Refresh through a `setTimeout` chain, about three times per second while open and once every two seconds while closed. Never run a `requestAnimationFrame` loop.
- Skip a refresh or deferred action while any screen has a transitional `data-flemo-status`; retry on the next tick.
- Render only the toggle while closed.
- Use no CSS transitions, keyframes or live-dashboard behaviour.
