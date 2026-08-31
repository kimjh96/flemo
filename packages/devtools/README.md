# @flemo/devtools

Zero-dependency flight recorder and optional visual panel for [flemo](https://flemo.dev) screen transitions. It observes existing `data-flemo-*` surfaces, `window.__flemoPlayerGaps`, leftover `flemo:*` storage keys, `MutationObserver`, `PerformanceObserver("longtask")`, and rAF, then produces a JSON report suitable for people or coding agents. It imports neither `@flemo/core` nor `@flemo/react`, and attaching it does not change measured motion.

## Quickstart

```ts
import { attachFlightRecorder } from "@flemo/devtools";

const recorder = attachFlightRecorder({ log: true });
// ...navigate...
const report = recorder.report(); // JSON-serializable FlemoReport
recorder.detach();
```

Unless disabled with `installGlobal: false` or the name is already owned, the recorder installs `window.flemo`:

```js
copy(JSON.stringify(window.flemo.report(), null, 2));
```

The playground supports `/playground?devtools=on`; `flemo:devtools` persists the toggle in `sessionStorage`, and `?devtools=off` disables it. `attachFlightRecorder()` is idempotent while attached and returns an inert handle during SSR.

## Production safety

The normal import resolves through `development` and `production` export conditions. In production it is an inert implementation that records nothing and does not enter the bundle:

```ts
import { attachFlightRecorder } from "@flemo/devtools";
const { detach } = attachFlightRecorder({ log: true });
```

Vite and Next set these conditions; not every bundler does. If yours does not, use a dynamic import behind a build-time constant:

```ts
// Vite
if (import.meta.env.DEV) {
  const { attachFlightRecorder } = await import("@flemo/devtools");
  attachFlightRecorder({ log: true });
}

// Next.js / webpack
if (process.env.NODE_ENV !== "production") {
  const { attachFlightRecorder } = await import("@flemo/devtools");
  attachFlightRecorder({ log: true });
}
```

Install the package as a `devDependency`, but do not rely on that to exclude it: dependency fields affect installation, not bundling. A called top-level import can ship to visitors. The package has `"sideEffects": false` and no import-time side effects, but a used binding cannot be tree-shaken.

`dist/index.mjs` is intentionally self-contained, so an internal `process.env.NODE_ENV` swap does not remove the implementation with bundlers such as esbuild that set neither condition; measured production and development bundles were byte-identical. Use the guarded import. Verify a production build does not contain `present-pipeline pacing`. See `apps/web/app/[lang]/playground/_hooks/useDevtoolsRecorder`.

`@flemo/devtools/force` always loads the real tool. Use it dynamically behind your own opt-in flag only when a staging deployment or production-build e2e suite needs the recorder.

## Visual panel

```ts
import { attachDevtoolsPanel } from "@flemo/devtools";
const panel = attachDevtoolsPanel();
// panel.detach();
```

The consumer must opt in and mount the panel behind a dev-only flag; flemo and its playground do not attach or ship it automatically. The floating toggle shows flight count and an anomaly dot. Its bottom drawer shows flights, per-flight detail, active overrides, and blind spots.

Options are `recorder`, `initialOpen` (default `false`), and `position` (`"bottom-right"` by default or `"bottom-left"`). Without `recorder`, the panel uses this package's `window.flemo` or attaches and owns a recorder. It is idempotent while mounted and inert without a DOM.

The panel is framework-free vanilla DOM in an open shadow root. Its fixed, zero-sized host is marked `data-flemo-devtools-panel`, has no `data-flemo-*` screen attributes, and cannot become a flight participant. Drawer height is resizable and persists under `flemo:devtools-panel-height` in `sessionStorage`.

The panel must never repaint during a flight:

- Refresh through a `setTimeout` chain, about three times per second while open and once every two seconds while closed; never use a persistent rAF loop.
- Skip refreshes and deferred UI actions while any screen has transitional `data-flemo-status`, then retry on the next tick.
- Render only the toggle while closed.
- Do not add CSS transitions, keyframes, or live-dashboard behavior.

## Report schema v2

A report contains:

- `generatedAt`, `version: "2"`, and `environment`: user agent and brands, engine, platform, touch count, DPR, screen and viewport sizes, visual viewport scale, idle `rafCadence`, reduced-motion state, emulation suspicion, and observation support for long tasks, element animations, and the player-gap mirror.
- `overrides.active`: every currently set `flemo:*` key from both storages, unknown keys, keys cleared since attachment, and persisted retired keys marked inert. Since flemo 2026-08-31 the library reads no `flemo:*` key at all, so every engine key found on a device is retired residue that explains nothing; `overrides.warnings` says so per key.
- `flights[]`: identity, router, navigation kind, timestamps, duration, detected driver, participants, holds, frame and phase statistics, motion, images, player gaps, long tasks, landing checks, and stable anomaly strings.
- Session `anomalies`, constant `blindSpots`, and constant `judgingProtocol`.

`driver` is detected per flight as `compiled`, `player`, `mixed`, or `unknown`; never infer it from platform policy. `holds.releasedAtMs` is the last hold release relative to `t0`. Held work is absorbed by design, so frame gaps and long tasks are split into held and released phases, and held gaps never raise anomalies.

`motion` answers whether pose advanced, independently of frame arrival. It records sampled and stalled frames, `longestStallMs` (an anomaly at 48ms or more), `pausedAfterRelease`, and `holdReassertedAtMs`, using animation clocks or inline poses without a style flush. Closing stationary frames are tail frames, not mid-flight stalls.

`images` records loading-at-start, additions, completions, held images, and `completedUnheld`. Count per image: a held loading image must not cancel an unheld completion. `longTasks` covers visible motion; `holdLongTasks` records absorbed work. Landing is audited two rAFs after `COMPLETED` for residual inline transforms, off-viewport rest, statuses stuck over 10 seconds, and orphaned holds. Skip the orphan audit if another flight is already running.

## Detected defects

Stable, grep-friendly anomaly signatures cover:

- `hold re-asserted …ms into the flight`: stale paused hold rewritten during motion.
- `motion stalled …ms mid-flight`: freeze or freeze-then-leap despite continuing rAF.
- `playState=paused`: posed motion stopped rather than frame starvation.
- `image(s) finished loading mid-flight without a hold`: decode rastered on the moving layer.
- `hold markers left on the page at rest`: hidden content has no owner to reveal it.
- `screen resting at from-pose while COMPLETED+active`: blank-viewport landing.
- `long task …ms overlapped the visible-motion start`: swallowed opening.
- `transitional status stuck >10s`: navigation queue remains locked.
- `active force pin flemo:motion-driver-force=…`: diagnostic residue pins a driver.

These checks exist because each defect shipped while frame timing remained clean.

## Judging protocol and blind spots

A valid verdict requires DevTools closed, no screen capture, real input, emulation off, and a known display, refresh rate, HiDPI scaling, and Low Power Mode state. The page cannot verify these conditions, so every report states them in `judgingProtocol`. Open DevTools caused the 2026-08 residual stutter; capture can suppress symptoms; synthetic dispatch bypasses `pointerdown` gesture behavior.

In-page instrumentation cannot observe macOS Chrome present-pipeline pacing on 120Hz ProMotion (Chromium issues 40062488/345275139), display-hardware effects, compositor-internal present skips, or DevTools emulation's post-scale surface. These remain in `blindSpots`. If a correctly judged report is clean but jank remains visible, investigate these layers instead of adding in-page instrumentation.

## Hand a report to an agent

1. Reproduce once with the recorder attached.
2. Run `copy(JSON.stringify(window.flemo.report(), null, 2))`.
3. Paste the JSON into the issue or conversation.

Read `overrides.warnings`, then `environment.emulationSuspected` and `rafCadence`, then each flight's `driver` and `anomalies`, and finally `blindSpots`.

## API

- `attachFlightRecorder(options?)` returns `{ report(), detach() }`. Options: `maxFlights` (50), `log` (`false`), `installGlobal` (`true`).
- `attachDevtoolsPanel(options?)` returns `{ detach() }`. Options: `recorder`, `initialOpen` (`false`), `position` (`"bottom-right"`).
- Pure helpers: `deriveFlightAnomalies`, `deriveReportAnomalies`, `deriveOverrideWarnings`, `classifyDriver`, `computeFrameStats`, `computePlayerGapStats`, `parseTranslateX`, `kindFromStatus`.
- Constants and registries: `BLIND_SPOTS`, `FLAG_REGISTRY`, `LONG_GAP_MS`, `STUCK_STATUS_MS`, `REPORT_SCHEMA_VERSION`.
- Environment probes: `captureEnvironment`, `detectEngine`, `isEmulationSuspected`, `sampleRafCadence`.
