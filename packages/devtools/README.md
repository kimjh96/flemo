# @flemo/devtools

Zero-dependency flight recorder and optional visual panel for [flemo](https://flemo.dev) transitions. It observes existing `data-flemo-*` surfaces, `window.__flemoPlayerGaps`, leftover `flemo:*` keys, `MutationObserver`, `PerformanceObserver("longtask")`, and rAF. It imports neither `@flemo/core` nor `@flemo/react` and does not alter measured motion.

## Quickstart

```ts
import { attachFlightRecorder } from "@flemo/devtools";

const recorder = attachFlightRecorder({ log: true });
// ...navigate...
const report = recorder.report(); // JSON-serializable FlemoReport
recorder.detach();
```

Unless `installGlobal: false` or the name is already owned, the recorder installs `window.flemo`:

```js
copy(JSON.stringify(window.flemo.report(), null, 2));
```

Use `/playground?devtools=on` to enable the playground recorder. `flemo:devtools` persists in `sessionStorage`; `?devtools=off` disables it. `attachFlightRecorder()` is idempotent while attached and returns an inert handle during SSR.

## Production safety

Normal imports use `development` and `production` export conditions. The production implementation is inert and records nothing:

```ts
import { attachFlightRecorder } from "@flemo/devtools";
const { detach } = attachFlightRecorder({ log: true });
```

Vite and Next set these conditions. For bundlers that do not, guard a dynamic import with a build-time constant:

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

Install as a devDependency, but do not rely on dependency fields for bundle exclusion. A used top-level import can ship even though the package has `"sideEffects": false` and no import-time effects. `dist/index.mjs` is self-contained; an internal `process.env.NODE_ENV` substitution did not reduce measured esbuild bundles when no export condition was set. Use the guarded import and verify production output lacks `present-pipeline pacing`. See `apps/web/app/[lang]/playground/_hooks/useDevtoolsRecorder`.

`@flemo/devtools/force` always loads the recorder. Import it dynamically behind an explicit opt-in only for staging or production-build E2E.

## Visual panel

```ts
import { attachDevtoolsPanel } from "@flemo/devtools";
const panel = attachDevtoolsPanel();
// panel.detach();
```

Consumers must opt in behind a development-only flag; flemo and its playground neither attach nor ship the panel automatically. The floating toggle shows flight count and an anomaly dot. The drawer shows flights, details, active overrides, and blind spots.

Options are `recorder`, `initialOpen` (`false`), and `position` (`"bottom-right"` or `"bottom-left"`). Without `recorder`, the panel reuses this package's `window.flemo` or owns a new recorder. It is idempotent while mounted and inert without a DOM.

The framework-free panel uses an open shadow root. Its fixed, zero-sized host has `data-flemo-devtools-panel`, no screen `data-flemo-*` attributes, and cannot join a flight. Drawer height persists as `flemo:devtools-panel-height` in `sessionStorage`.

The panel must not repaint during a flight:

- Refresh with a `setTimeout` chain about three times per second while open and once every two seconds while closed; never keep an rAF loop.
- Skip refreshes and deferred actions while any screen has transitional `data-flemo-status`, then retry next tick.
- Render only the toggle while closed.
- Add no CSS transitions, keyframes, or live-dashboard behavior.

## Report schema v2

Reports contain:

- `generatedAt`, `version: "2"`, and `environment`: user agent and brands, engine, platform, touch count, DPR, screen and viewport sizes, visual viewport scale, idle `rafCadence`, reduced motion, emulation suspicion, and support for long tasks, element animations, and the player-gap mirror.
- `overrides.active`: all `flemo:*` keys in both storages, unknown keys, keys cleared since attachment, and retired persisted keys marked inert. Since 2026-08-31, flemo reads no `flemo:*` engine key; `overrides.warnings` explains each residue key.
- `flights[]`: identity, router, navigation kind, timestamps, duration, detected driver, participants, holds, frame and phase statistics, motion, images, player gaps, long tasks, landing checks, and stable anomaly strings.
- Session `anomalies`, constant `blindSpots`, and constant `judgingProtocol`.

`driver` is classified per flight as `compiled`, `player`, `mixed`, or `unknown`; never infer it from platform policy. `holds.releasedAtMs` is the last release relative to `t0`. Held work is intentionally absorbed, so frame gaps and long tasks are separated into held and released phases; held gaps do not raise anomalies.

`motion` measures pose advancement independently of frame arrival. It records sampled and stalled frames, `longestStallMs` with an anomaly threshold of 48 ms, `pausedAfterRelease`, and `holdReassertedAtMs`, using animation clocks or inline poses without a style flush. Stationary closing frames are tails, not mid-flight stalls.

`images` records loading at start, additions, completions, held images, and `completedUnheld`; count per image so a held loading image cannot cancel an unheld completion. `longTasks` covers visible motion and `holdLongTasks` covers absorbed work. Landing is audited two rAFs after `COMPLETED` for residual inline transforms, off-viewport rest, statuses stuck over 10 seconds, and orphaned holds. Skip orphan auditing when another flight is running.

## Detected defects

Stable anomaly signatures include:

- `hold re-asserted …ms into the flight`: a stale paused hold was rewritten during motion.
- `motion stalled …ms mid-flight`: motion froze or froze then leapt despite continuing rAF.
- `playState=paused`: posed motion stopped rather than suffering frame starvation.
- `image(s) finished loading mid-flight without a hold`: decode rastered on the moving layer.
- `hold markers left on the page at rest`: hidden content has no owner to reveal it.
- `screen resting at from-pose while COMPLETED+active`: blank-viewport landing.
- `long task …ms overlapped the visible-motion start`: swallowed opening.
- `transitional status stuck >10s`: the navigation queue remains locked.
- `active force pin flemo:motion-driver-force=…`: diagnostic residue pins a driver.

These defects have occurred with clean frame timing.

## Judging protocol and blind spots

A valid verdict requires DevTools closed, no capture, real input, emulation off, and known display, refresh rate, HiDPI scaling, and Low Power Mode state. The page cannot verify these, so every report includes `judgingProtocol`. Open DevTools caused 2026-08 residual stutter; capture can suppress symptoms; synthetic dispatch bypasses `pointerdown` gesture behavior.

In-page tools cannot observe macOS Chrome present-pipeline pacing on 120 Hz ProMotion (Chromium issues 40062488/345275139), display hardware, compositor-internal present skips, or the post-scale DevTools emulation surface. These remain in `blindSpots`. If a correctly judged report is clean but jank is visible, investigate those layers instead of adding in-page instrumentation.

## Hand a report to an agent

1. Reproduce once with the recorder attached.
2. Run `copy(JSON.stringify(window.flemo.report(), null, 2))`.
3. Paste the JSON into the issue or conversation.

Read `overrides.warnings`, `environment.emulationSuspected`, `rafCadence`, each flight's `driver` and `anomalies`, then `blindSpots`.

## API

- `attachFlightRecorder(options?)` returns `{ report(), detach() }`; options: `maxFlights` (50), `log` (`false`), `installGlobal` (`true`).
- `attachDevtoolsPanel(options?)` returns `{ detach() }`; options: `recorder`, `initialOpen` (`false`), `position` (`"bottom-right"`).
- Pure helpers: `deriveFlightAnomalies`, `deriveReportAnomalies`, `deriveOverrideWarnings`, `classifyDriver`, `computeFrameStats`, `computePlayerGapStats`, `parseTranslateX`, `kindFromStatus`.
- Constants and registries: `BLIND_SPOTS`, `FLAG_REGISTRY`, `LONG_GAP_MS`, `STUCK_STATUS_MS`, `REPORT_SCHEMA_VERSION`.
- Environment probes: `captureEnvironment`, `detectEngine`, `isEmulationSuspected`, `sampleRafCadence`.
