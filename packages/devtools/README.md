# @flemo/devtools

Zero-config flight recorder for [flemo](https://flemo.dev) screen transitions.

It watches the DOM surfaces flemo already exposes — `data-flemo-*` attributes,
`window.__flemoPlayerGaps`, the `flemo:*` storage registry — plus standard
observers (`MutationObserver`, `PerformanceObserver("longtask")`, rAF), and
condenses every navigation into one structured JSON report. The goal: a coding
agent can diagnose a transition problem from the report alone, without
round-tripping through the user ("which browser? was DevTools open? did you
leave a toggle set?").

Zero dependencies. No imports from `@flemo/core` or `@flemo/react`; attaching
the recorder never changes the motion it measures.

## Quickstart

```ts
import { attachFlightRecorder } from "@flemo/devtools";

const recorder = attachFlightRecorder({ log: true });

// ...navigate around...

const report = recorder.report(); // JSON-serializable FlemoReport
recorder.detach();
```

The recorder also installs `window.flemo` (unless something else already owns
that name, or you pass `installGlobal: false`):

```js
copy(JSON.stringify(window.flemo.report(), null, 2)); // DevTools console
```

In the flemo playground it is pre-wired: visit `/playground?devtools=on` (the
toggle is stored in `sessionStorage` under `flemo:devtools`, so it survives
navigation; `?devtools=off` disarms it).

`attachFlightRecorder()` is idempotent — while a recorder is attached, further
calls return the same handle. In non-DOM environments (SSR) it returns an
inert handle.

## Visual panel

The same data, on screen. `attachDevtoolsPanel()` mounts a floating `flemo`
toggle (flight count, plus a red dot when any flight carries an anomaly) and a
bottom drawer with the flight list, the per-flight detail, the active
overrides, and the blind-spot list.

```ts
import { attachDevtoolsPanel } from "@flemo/devtools";

const panel = attachDevtoolsPanel(); // reads window.flemo, or attaches its own
// panel.detach();
```

The panel is opt-in and mounted by the consumer: nothing in flemo attaches it
for you, and the flemo playground deliberately arms the recorder only (the
site should not ship a debug UI). Mount it behind your own dev-only flag.

Options: `recorder` (a handle from `attachFlightRecorder`; defaults to this
package's `window.flemo`, otherwise the panel attaches — and owns — one),
`initialOpen` (default false), `position` (`"bottom-right"` default, or
`"bottom-left"`). Zero dependencies, no framework: vanilla DOM inside an open
shadow root, so no consumer CSS reaches in and none of the panel's reaches
out. The host is `position: fixed`, zero-sized, marked
`data-flemo-devtools-panel`, and carries no `data-flemo-*` screen attributes —
the recorder never sees the panel as a flight participant. Drag the drawer's
top edge to resize; the height persists in `sessionStorage` under
`flemo:devtools-panel-height`.

**It never repaints during a flight.** That is the design constraint, not a
nicety: this project once spent weeks chasing stutter that turned out to be
_DevTools being open_ (see `docs/postmortems/`), and a measurement surface
that repaints mid-transition reproduces that artifact and then reports it as a
finding. So the panel

- refreshes on a `setTimeout` chain (~3×/s open, once per 2s closed) — never a
  persistent `requestAnimationFrame` loop competing with the motion,
- **skips any refresh while a screen carries a transitional
  `data-flemo-status`** and retries on the next tick — deferred user actions
  (open/close, row selection) included,
- renders only the toggle button while closed,
- ships no CSS transitions and no keyframes at all.

Do not turn it into a live-updating dashboard.

## Report schema (version "2")

```jsonc
{
  "generatedAt": "2026-08-17T09:00:00.000Z",
  "version": "2",
  "environment": {
    "userAgent": "…",
    "uaBrands": [{ "brand": "Chromium", "version": "126" }],
    "engine": "blink", // blink | webkit | gecko | unknown
    "platform": "MacIntel",
    "maxTouchPoints": 0,
    "devicePixelRatio": 2,
    "screen": { "width": 1728, "height": 1117 },
    "viewport": { "width": 1280, "height": 720 },
    "visualViewportScale": 1,
    "rafCadence": { "medianGapMs": 16.67, "sampleCount": 20 }, // idle sample at attach
    "reducedMotion": false,
    "emulationSuspected": false, // DevTools device-toolbar signature
    "observation": { "longTasks": true, "elementAnimations": true, "playerGapMirror": false }
  },
  "overrides": {
    // Every flemo:* storage key currently set (both storages), including
    // unknown keys and keys present at attach but cleared since (marked).
    "active": { "flemo:apply": "scrub" },
    // Read these FIRST. A non-empty warnings list means the session does not
    // run stock behavior — especially the driver force pin, which pins EVERY
    // transition and once burned a multi-day investigation as residue.
    "warnings": ["flemo:apply=scrub — opt-in diagnostic active (…)"]
  },
  "driverPolicy": {
    "demotion": null, // localStorage flemo:motion-driver ("css" = player demoted)
    "forcePin": null // sessionStorage flemo:motion-driver-force — non-null = PIN ACTIVE
  },
  "flights": [
    {
      "id": "flight-1",
      "routerId": "…", // when the screen stamps data-flemo-router
      "kind": "PUSH", // PUSH | POP | REPLACE
      "t0": { "ms": 1234.5, "iso": "…" }, // performance.now + wall clock
      "t1": { "ms": 1834.5, "iso": "…" },
      "durationMs": 600,
      // player | compiled | mixed | unknown — detected per flight from the
      // DOM signature (inline animation suppression + advancing inline pose
      // = player; a running flemo-* CSSAnimation = compiled). Never assume a
      // platform always routes one tier; routing policies evolve.
      "driver": "compiled",
      "participants": { "screens": 2, "bars": 0, "decorators": 1, "parts": 0 },
      // data-flemo-anim-hold: releasedAtMs = when the LAST hold released,
      // relative to t0. The engine absorbs heavy commits INTO the hold (the
      // screen is posed, not moving), so everything below is segmented on
      // this boundary.
      "holds": { "kind": "park-under", "releasedAtMs": 120 },
      "frameSamples": {
        "count": 36,
        "medianGapMs": 16.7,
        "maxGapMs": 17.2,
        "longGaps": [],
        // held-phase gaps are absorbed by design — no anomaly ever fires on them;
        "held": { "count": 7, "medianGapMs": 18.1, "maxGapMs": 45.0, "over30Count": 1 },
        // released-phase gaps are visible motion — the anomaly rules key on these.
        "released": { "count": 29, "medianGapMs": 16.7, "maxGapMs": 17.2, "over30Count": 0 }
      },
      // Did it MOVE — a different question from "did frames arrive". A
      // compiled flight is read off its own animation clock, a player flight
      // off the inline pose it writes; neither forces a style flush.
      "motion": {
        "sampledFrames": 29,
        "stalledFrames": 0, // released frames where neither clock nor pose moved
        "longestStallMs": 0, // >= 48ms raises an anomaly
        "pausedAfterRelease": false, // playState went "paused" mid-motion
        "holdReassertedAtMs": null // a hold went back ON after releasing
      },
      // Images inside the participants. One still-loading <img> completing
      // mid-flight costs one skipped present (glass-measured 1:1), which is
      // why the engine holds them; an unheld completion is that regression.
      // completedUnheld is the number that matters, counted PER IMAGE: a
      // held-but-still-loading image must not cancel out an unheld completed
      // one. addedDuringFlight covers images a data commit inserts mid-
      // navigation, which is the case core's image hold also watches for.
      "images": {
        "loadingAtStart": 12,
        "addedDuringFlight": 0,
        "completedDuringFlight": 0,
        "heldDuringFlight": 12,
        "completedUnheld": 0
      },
      "playerGaps": { "maxMs": 42.3, "over30Count": 1 }, // only if the player mirror grew
      "longTasks": [{ "startMs": 1200.0, "durationMs": 180.0 }], // intersecting visible motion
      "holdLongTasks": [], // fully absorbed by the hold — engine working as designed
      "landing": {
        // Audited 2 rAF after COMPLETED:
        "residualInlineTransforms": [], // inline transform/opacity leftovers
        "offViewportAtRest": false, // the blank-viewport (PR #259) signature
        "stuckStatuses": [], // transitional statuses >10s old
        // Hold markers still on the page at rest. Skipped (left empty) when
        // another flight is already running: two frames after a landing, a
        // fast back-to-back navigation legitimately owns holds of its own.
        "orphanedHolds": []
      },
      "anomalies": ["long task 180ms overlapped flight start (opening-swallow risk)"]
    }
  ],
  "anomalies": [], // session-level: active pins, emulation, stuck flights
  "blindSpots": ["…"], // constant — see below
  "judgingProtocol": ["…"] // constant — the preconditions a verdict needs
}
```

## What it is built to catch

Every rule below exists because the matching defect actually shipped, was
lived with, and cost days. They share one property: **frame timing was clean
through all of them.** A recorder that only measured gaps would have called
each of these sessions healthy.

| Signature in `anomalies`                              | The defect it guards against                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `hold re-asserted …ms into the flight`                | An interleaved commit writing the stale paused hold attribute over a running flight — froze motion ~250ms, intermittently |
| `motion stalled …ms mid-flight`                       | Any freeze / freeze-then-leap: the pose stopped advancing while rAF kept ticking                                          |
| `playState=paused`                                    | The flight was posed and then stopped, rather than starved of frames                                                      |
| `image(s) finished loading mid-flight without a hold` | Warm-side image decode rastering on the sliding layer — one skipped present per decode                                    |
| `hold markers left on the page at rest`               | Orphaned image/arrival holds: content hidden with no owner left to reveal it (the permanently-blank-avatar class)         |
| `screen resting at from-pose while COMPLETED+active`  | The blank-viewport landing (PR #259)                                                                                      |
| `long task …ms overlapped the visible-motion start`   | The swallowed opening (씹힘)                                                                                              |
| `transitional status stuck >10s`                      | A locked navigation queue — every later navigation is silently ignored                                                    |
| `active force pin flemo:motion-driver-force=…`        | A/B residue pinning the whole session to one driver (this one burned a multi-day investigation)                           |

## The judging protocol

Every report also carries `judgingProtocol`. It is not derived — the page
cannot check it — so it is stated instead:

- **DevTools closed.** The 2026-08 campaign's entire residual "stutter" was
  the open inspector, verified bidirectionally on the reporting machine. A
  clean report from a DevTools-open session proves nothing.
- **No screen capture running.** A capture client forces the compositor to a
  steady cadence and _suppresses_ the symptom.
- **Real input.** Synthetic dispatch never fires `pointerdown`, so it bypasses
  the gesture machinery a real navigation goes through.
- **Known viewing configuration.** Emulation off; which display, refresh rate,
  HiDPI scaling, Low Power Mode.

## Blind spots

Every report ends with a constant `blindSpots` list: the layers **no in-page
instrument can see**, each of which once consumed a real investigation:

- macOS Chrome present-pipeline pacing (Chromium issues 40062488/345275139) —
  frames judder on 120Hz ProMotion while every in-page metric reads clean;
  proven with a no-script pure-CSS control page.
- Display-hardware effects (local dimming, backlight modulation).
- Compositor-internal present skips invisible to rAF.
- DevTools device emulation composites to a rescaled surface — instruments
  read the pre-scale surface, the eye watches the post-scale one.

If the report is clean and the user still sees jank, the cause lives in one of
these. Do not chase them with in-page tooling.

## Handing a report to an agent

1. Reproduce the problem once with the recorder attached (playground:
   `/playground?devtools=on`).
2. `copy(JSON.stringify(window.flemo.report(), null, 2))` in the console.
3. Paste the JSON into the issue/conversation.

Reading order for the agent: `overrides.warnings` (is this session even
stock?) → `environment.emulationSuspected` + `rafCadence` (is the observation
trustworthy? what display cadence?) → per-flight `driver` + `anomalies`
(which tier ran, what went wrong, when) → `blindSpots` (what not to chase).
All anomaly strings are stable, grep-friendly signatures.

## API

- `attachFlightRecorder(options?)` → `{ report(), detach() }` — options:
  `maxFlights` (default 50), `log` (default false), `installGlobal`
  (default true).
- `attachDevtoolsPanel(options?)` → `{ detach() }` — options: `recorder`,
  `initialOpen` (default false), `position` (default `"bottom-right"`).
  Idempotent while mounted; inert without a DOM.
- Pure helpers (unit-testable, no DOM): `deriveFlightAnomalies`,
  `deriveReportAnomalies`, `deriveOverrideWarnings`, `classifyDriver`,
  `computeFrameStats`, `computePlayerGapStats`, `parseTranslateX`,
  `kindFromStatus`.
- Constants/registries: `BLIND_SPOTS`, `FLAG_REGISTRY`, `LONG_GAP_MS`,
  `STUCK_STATUS_MS`, `REPORT_SCHEMA_VERSION`.
- Environment probes: `captureEnvironment`, `detectEngine`,
  `isEmulationSuspected`, `sampleRafCadence`.
