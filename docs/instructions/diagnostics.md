# flemo diagnostics reference

Use this reference when instrumenting a device session. Per-browser decisions are resolved in `packages/core/src/platform/profile.ts` and pinned by `platformDefaults.test.ts`.

## 0. Start with the flight recorder

Attach `@flemo/devtools` before changing anything and reproduce once. The playground entrypoint is `/playground?devtools=on`. `window.flemo.report()` returns the driver tier, A/B residue, observation trustworthiness, and known 2026 defect classes.

Read these sections carefully:

- `flights[].motion` reports whether the pose advanced, not merely whether frames arrived. Release races, hold re-assertions, and freeze-then-leap defects can have clean frame timing while the screen is stationary.
- `judgingProtocol` states required conditions that the page cannot verify: DevTools closed, no capture, and real input. A clean report collected with DevTools open is not evidence.

## 1. There are no `flemo:*` engine flags

Core reads no `flemo:*` storage key. All 24 former keys and their registry were removed on 2026-08-31 because diagnostic instruments and their documentation should not ship in consumer bundles. Each former override is now a computed default.

Per-browser behavior did not change because consumers never set these keys. Comparing alternative behavior now requires building the branch that implements it; consider that cost before restoring an override.

Only `@flemo/devtools` owns active keys: `flemo:devtools`, which arms the recorder, and `flemo:devtools-panel-height`. That package is installed only as a devDependency.

### Residual-toggle hazard

Session toggles outlive their A/B test. Mobile tab restoration can preserve `sessionStorage` for days. Two incidents demonstrate the risk:

- A lingering `?snap=off` toggle caused weeks of false “shimmer is back” reports; its badge was visible in the user's recording.
- A legacy `flemo:lat` seed silently defeated a newer build's pessimistic branch.

Former engine keys are inert, but devtools enumerates them so they are not mistaken for active causes. `overrides.warnings` provides the retirement note for each key. Read it first for every regression report.

## 2. Inspecting residue

Use `Object.entries(sessionStorage).filter(([k]) => k.startsWith("flemo:"))` or the recorder report to inspect stored keys. No discovered engine key can affect flight behavior; treat it as archaeology, clear it, and continue.

## 3. There are no `window.__flemo*` globals

`window.__flemoPlayerGaps` mirrored the rAF motion player's frame gaps. Both the global and `transitionPlayer.ts` were removed when the player was retired, and nothing replaced them: a compiled flight has no main-thread clock to read. Frame evidence now comes from a recording or a screenshot-energy probe, not from a global.

## 4. E2E helpers (`apps/web/e2e/`)

- `helpers/flemo.ts` provides `activeScreen` and `allScreens` for `data-flemo-*` locators; `waitForNavIdle(page)`, which waits until no screen is PUSHING, POPPING, or REPLACING plus a 150 ms grace period; and `trackConsoleErrors`, which filters network 404 noise.
- `swipe-release.spec.ts` and `swipe-declared.spec.ts` drive a real pointer against the compiled CSS and read what the screens and the dim actually carry. They are the nets for defects a unit test cannot see: the relationship between two elements' computed styles at one instant of a gesture, and whether an engine walks the keyframes a declaration assembled.
- Bound a landing by its own travel rather than by a fraction of the box. A rAF sampler on a slow runner catches the same flight in bigger pieces, so a bound in pixels measures the runner. That mistake failed a probe twice on CI while it passed fourteen times in a row locally.
- Prove a probe fails before trusting it. Forcing `swipeSettleSeconds` to return 0 turns every release into a cut, which is what the flick case claims to catch.
- `morph-first-frame.spec.ts` and `devtools-production.spec.ts` cover the morph's opening frame and that the devtools import is inert in a production bundle.

CI runs `--project=chromium --project=mobile-chromium`. Running only one of them locally is how a desktop-only failure reaches CI unseen.

## 5. Observation pitfalls

Apply this checklist before judging motion:

1. **DevTools emulation:** Device emulation composites the page into a separately scaled, often fractionally rescaled surface. Moving text may shimmer continuously and post-landing housekeeping may flash even when the same build is clean in a normal window. `emulationNotice.ts` warns once per session when a transition runs under suspected emulation: Blink on Mac with `maxTouchPoints > 0`, because Macs have no touchscreen. Before code work, establish the exact viewing setup and request a screenshot of the whole setup, including window versus emulation, display, and display scaling.
2. **Residual toggles:** Inspect badges and toggles visible in user recordings first. A forgotten `?snap=off` caused a false regression report.
3. **FPS and performance overlays:** DevTools FPS, `--show-fps-counter`, and DevTools Performance recording force continuous presentation. On macOS Chrome, the overlay can switch presentation into a continuous-even mode that hides judder and remains sticky until browser restart. It can be a machine-level workaround, never evidence of a fix.
4. **Screencast cadence:** Tab and Playwright screencasts omit presented frames, so capture gaps can alias into phantom periodic re-rolls. Judge pixel phenomena with screenshot-energy probes or a real camera, not screencast timing.
5. **Tracing:** `devtools.timeline` tracing forces per-vsync frames. When investigating frame pacing, use non-forcing categories `cc,benchmark`; the PipelineReporter argument key is `frame_reporter`.
6. **Playwright field trials:** Playwright disables field trials. If a relevant Chrome behavior depends on one, pass `ignoreDefaultArgs` for the applicable switches.
7. **`file:` tarball caching:** Bun caches tarballs by filename, so rename every repack, for example `flemo-core-x.y.z-r2.tgz`. Vite's `?v=<hash>` may remain unchanged after a `file:` dependency's contents change, leaving stale bytes in both the development server and phone HTTP cache. After every tarball swap, restart once with `--force`, then fingerprint the served dependency: find its live URL with `curl <app>/src/App.tsx | grep -o 'deps/@flemo_react[^\"]*'` and grep that bundle for a marker unique to the change. An application version badge proves only that source modules refreshed, not the flemo dependency bundle. `curl | grep` cannot detect a JavaScript syntax error in an injected inline script; execute probes in a real browser.
8. **rAF under throttling:** Under iOS Low Power Mode, the web process may update around 30 Hz while the compositor presents at panel rate. rAF HUD readings such as even 8.33 ms or 33 ms gaps do not establish what the panel displayed. Playwright WebKit reports `maxTouchPoints=0` even with iPhone emulation, so touch-WebKit and Low Power Mode paths require testing on physical hardware.
9. **Compositor effects:** `getComputedStyle`, screencasts, and rAF samples observe the main-thread side, not compositor-internal swallowed openings or present-pipeline judder. If instruments are clean but visible jank remains, trust the observation and use screenshot-energy probes, camera video, or frame-extracted screen recordings. A 30 fps phone recording is often decisive.
