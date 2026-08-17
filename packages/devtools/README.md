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

## Report schema (version "1")

```jsonc
{
  "generatedAt": "2026-08-17T09:00:00.000Z",
  "version": "1",
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
      "holds": { "kind": "park-under", "releasedAtMs": 120 }, // data-flemo-anim-hold
      "frameSamples": { "count": 36, "medianGapMs": 16.7, "maxGapMs": 17.2, "longGaps": [] },
      "playerGaps": { "maxMs": 42.3, "over30Count": 1 }, // only if the player mirror grew
      "longTasks": [{ "startMs": 1200.0, "durationMs": 180.0 }], // overlapping the flight
      "landing": {
        // Audited 2 rAF after COMPLETED:
        "residualInlineTransforms": [], // inline transform/opacity leftovers
        "offViewportAtRest": false, // the blank-viewport (PR #259) signature
        "stuckStatuses": [] // transitional statuses >10s old
      },
      "anomalies": ["long task 180ms overlapped flight start (opening-swallow risk)"]
    }
  ],
  "anomalies": [], // session-level: active pins, emulation, stuck flights
  "blindSpots": ["…"] // constant — see below
}
```

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
- Pure helpers (unit-testable, no DOM): `deriveFlightAnomalies`,
  `deriveReportAnomalies`, `deriveOverrideWarnings`, `classifyDriver`,
  `computeFrameStats`, `computePlayerGapStats`, `parseTranslateX`,
  `kindFromStatus`.
- Constants/registries: `BLIND_SPOTS`, `FLAG_REGISTRY`, `LONG_GAP_MS`,
  `STUCK_STATUS_MS`, `REPORT_SCHEMA_VERSION`.
- Environment probes: `captureEnvironment`, `detectEngine`,
  `isEmulationSuspected`, `sampleRafCadence`.
