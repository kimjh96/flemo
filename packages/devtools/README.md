# @flemo/devtools

Zero-dependency flight recorder, on-device readout and visual panel for [flemo](https://flemo.dev) transitions. It observes existing `data-flemo-*` surfaces, leftover `flemo:*` keys, CSS animation events, pointer events, `MutationObserver`, `PerformanceObserver("longtask")`, and rAF. It imports neither `@flemo/core` nor `@flemo/react` and does not alter measured motion.

Everything in it is one probe module per question — pacing, motion, images, shared elements, one-frame events, landing residue — behind a small orchestrator. Adding a measurement means adding a probe.

## Quickstart

```ts
import { attachFlightRecorder } from "@flemo/devtools";

const recorder = attachFlightRecorder({ log: true });
// ...navigate...
const report = recorder.report(); // JSON-serializable FlemoReport
recorder.mark("A"); // label the flights that follow, for a comparison
recorder.detach();
```

Read `report.verdict` first. It is the recorder's own reading of the session in plain sentences, and it refuses to summarise data from a session that was not allowed to produce evidence.

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

## On-device readout

```ts
import { attachDevtoolsHud } from "@flemo/devtools";
const hud = attachDevtoolsHud({ position: "top" });
// hud.detach();
```

A phone has no console. The readout is one monospaced line, high contrast and readable in a photograph of the device:

```
POP 412ms  gap 33.4  drop 1  !2
```

Tap it for the detail block (frames, motion, holds, shared elements, what drove the navigation, and the flight's anomalies); long-press to cycle the comparison bucket. Options are `recorder`, `position` (`"top"` or `"bottom"`), `initialExpanded` (`false`) and `buckets` (`["A", "B"]`).

It obeys the same rules the panel does: it repaints only between flights, its stylesheet carries no transition and no keyframe, and its host is a zero-sized fixed element that cannot join a flight.

## Visual panel

```ts
import { attachDevtoolsPanel } from "@flemo/devtools";
const panel = attachDevtoolsPanel();
// panel.detach();
```

Consumers must opt in behind a development-only flag; flemo and its playground neither attach nor ship the panel automatically. The floating toggle shows flight count and an anomaly dot. The drawer shows flights, details, active overrides, and blind spots.

Options are `recorder`, `initialOpen` (`false`), `position` (`"bottom-right"` or `"bottom-left"`) and `buckets` (`["A", "B"]`). Without `recorder`, the panel reuses this package's `window.flemo` or owns a new recorder. It is idempotent while mounted and inert without a DOM. The header leads with the verdict and every failed precondition, and carries an A/B button that arms the comparison buckets.

The framework-free panel uses an open shadow root. Its fixed, zero-sized host has `data-flemo-devtools-panel`, no screen `data-flemo-*` attributes, and cannot join a flight. Drawer height persists as `flemo:devtools-panel-height` in `sessionStorage`.

The panel must not repaint during a flight:

- Refresh with a `setTimeout` chain about three times per second while open and once every two seconds while closed; never keep an rAF loop.
- Skip refreshes and deferred actions while any screen has transitional `data-flemo-status`, then retry next tick.
- Render only the toggle while closed.
- Add no CSS transitions, keyframes, or live-dashboard behavior.

## Report schema v3

Reports contain:

- `generatedAt`, `version: "3"`, and `verdict`: the session read back in sentences, most important first.
- `preconditions[]`: the observable half of the judging protocol, each `ok`, `violated` or `unknown` with the reasoning and its numbers. The traps a page cannot see stay `unknown` forever rather than being guessed at.
- `environment`: user agent and brands, engine, platform, touch count, DPR, hardware concurrency, screen and viewport sizes, visual viewport scale, idle `rafCadence`, reduced motion, development-server globals, emulation suspicion, and what the recorder could observe (long tasks, element animations, and whether its own animation channel ever fired).
- `overrides.active`: all `flemo:*` keys in both storages, unknown keys, keys cleared since attachment, and retired persisted keys marked inert. Since 2026-08-31, flemo reads no `flemo:*` engine key; `overrides.warnings` explains each residue key.
- `flights[]`: identity, router, bucket, navigation kind, timestamps, duration, detected driver, participants, holds, frame and phase statistics, motion, images, shared elements, tripwire hits, what drove it, long tasks, landing checks, and stable anomaly strings.
- `comparison[]`: per-bucket medians, worst gaps, drops, anomalies and stalls; empty until `mark()` arms a label.
- `previousSession`: flights carried across the last full page load, kept apart from the live ones.
- Session `anomalies`, constant `blindSpots`, and constant `judgingProtocol`.

`driver` is classified per flight as `compiled`, `inline`, `mixed`, or `unknown`; never infer it from platform policy. flemo compiles every animation, so `inline` means something else is writing frames onto a participant. `holds.releasedAtMs` is the last release relative to `t0`. Held work is intentionally absorbed, so frame gaps and long tasks are separated into held and released phases; held gaps do not raise anomalies.

`motion` measures pose advancement independently of frame arrival. It records sampled and stalled frames, `longestStallMs` with an anomaly threshold of 48 ms, `pausedAfterRelease`, and `holdReassertedAtMs`, using animation clocks or inline poses without a style flush. Stationary closing frames are tails, not mid-flight stalls.

`morphs` answers the question a shared element cannot answer for itself. A morph that does not pair produces no error, no attribute and no animation, so the runtime writes the pairing key onto every registered morph (`data-flemo-morph-id`) and this section groups the ends: `pairable` had everything they needed, `flew` were stamped with a flight role, and `skipped` is the difference. It also reports duplicate keys inside one screen (a consumer mistake, not a runtime one) and the residue a landing left behind: roles, stand-ins, ghosts, elements stranded in a flight layer, and keyframe rules never dropped.

`tripwires` are events the browser REPORTED rather than samples the recorder took: a cancelled flemo animation, an `animationend` carrying `elapsedTime` 0, a hold re-asserted after its release, a ghost cut inside a frame. A sampler cannot see a defect that lasts one frame; a listener cannot miss it.

`input` records the trusted and synthetic pointer events around the flight and the pointer types among them. A session driven only by script never fires the gesture machinery, and a session driven only by a mouse never exercises the touch path.

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
- `shared element(s) did not fly`: both ends were registered on two screens and neither took a flight role.
- `morph element(s) still carry a flight role at rest`: a stranded participant that poisons the next pairing.
- `tripwire zero-length-animation-end`: something landed on an animation that never ran.
- `active force pin flemo:motion-driver-force=…`: diagnostic residue pins a driver.

These defects have occurred with clean frame timing.

## Judging protocol and blind spots

A valid verdict requires DevTools closed, no capture, real input, emulation off, a production build, an idle machine, and known display, refresh rate, HiDPI scaling and Low Power Mode state. The ones a page CAN check are checked and appear in `preconditions` — emulation, display cadence, foreground, machine contention, build mode, real and touch input, reduced motion. The rest stay `unknown` there and are stated in `judgingProtocol`. Open DevTools caused 2026-08 residual stutter; capture can suppress symptoms; synthetic dispatch bypasses `pointerdown` gesture behavior.

In-page tools cannot observe macOS Chrome present-pipeline pacing on 120 Hz ProMotion (Chromium issues 40062488/345275139), display hardware, compositor-internal present skips, or the post-scale DevTools emulation surface. These remain in `blindSpots`. If a correctly judged report is clean but jank is visible, investigate those layers instead of adding in-page instrumentation.

## Hand a report to an agent

1. Reproduce once with the recorder attached.
2. Run `copy(JSON.stringify(window.flemo.report(), null, 2))`.
3. Paste the JSON into the issue or conversation.

Read `verdict`, then `preconditions`, then each flight's `anomalies`, then `blindSpots`. A number from a session with a violated precondition is not evidence.

## API

- `attachFlightRecorder(options?)` returns `{ report(), mark(), detach() }`; options: `maxFlights` (50), `log` (`false`), `installGlobal` (`true`), `persist` (`true`).
- `attachDevtoolsHud(options?)` returns `{ detach() }`; options: `recorder`, `position` (`"top"`), `initialExpanded` (`false`), `buckets`.
- `attachDevtoolsPanel(options?)` returns `{ detach() }`; options: `recorder`, `initialOpen` (`false`), `position` (`"bottom-right"`), `buckets`.
- Pure helpers: `deriveFlightAnomalies`, `deriveReportAnomalies`, `deriveOverrideWarnings`, `derivePreconditions`, `deriveVerdict`, `summariseBuckets`, `classifyDriver`, `computeFrameStats`, `parseTranslateX`, `kindFromStatus`.
- Constants and registries: `BLIND_SPOTS`, `JUDGING_PROTOCOL`, `FLAG_REGISTRY`, `LONG_GAP_MS`, `STALL_MS`, `STUCK_STATUS_MS`, `REPORT_SCHEMA_VERSION`.
- Environment probes: `captureEnvironment`, `detectEngine`, `developmentHints`, `isEmulationSuspected`, `sampleRafCadence`.
- Trace storage: `loadTrace`, `saveTrace`, `clearTrace`, `TRACE_KEY`.
