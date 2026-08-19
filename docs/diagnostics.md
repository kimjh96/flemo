# flemo diagnostics reference

For agents and humans instrumenting a device session. The single source of truth for
flag semantics is the header table in
`packages/core/src/core/engine/diagnosticFlags.ts` (landed in PR #258) — this document
adds _how to use them_ and the observation pitfalls that cost the 2026 campaigns weeks.

## 0. Start with the flight recorder

Before setting any flag by hand, attach `@flemo/devtools` (playground:
`/playground?devtools=on`) and reproduce once. `window.flemo.report()` answers, in one
JSON blob, the questions this document otherwise asks you to establish manually: which
tier drove each flight, whether the session carries A/B residue, whether the observation
itself is trustworthy — and it names the defect classes the 2026 campaigns actually
shipped fixes for, so a returning regression arrives as a sentence instead of a hunt.

Two of its sections exist because the campaign learned them the hard way:

- `flights[].motion` — whether the pose ADVANCED, not merely whether frames arrived.
  Every defect in the 2026-08-18 round (release race, hold re-assert, freeze-then-leap)
  had clean frame timing while the screen stood still. Timing alone would have called
  those sessions healthy.
- `judgingProtocol` — the preconditions a verdict needs (DevTools closed, no capture
  running, real input). A page cannot verify these, so the report states them; a clean
  report from a DevTools-open session is not evidence. See pitfall #1 below.

## 1. The `flemo:*` storage keys

All keys live in `sessionStorage` except `flemo:motion-driver` (localStorage). Set them
in DevTools (`sessionStorage.setItem("flemo:apply", "scrub")`) and — for the cached set
— **reload**. Full table with values/defaults/classes: `diagnosticFlags.ts`. Summary:

**Production state (never set by hand; key strings frozen — persisted on users' devices)**

- `flemo:motion-driver` — player demotion ledger (`driverPolicy.ts`).
- `flemo:lpm` — low-power cadence verdict seed (`lowPowerCadence.ts`).
- `flemo:lat` — LPM release-latency seed (`lowPowerCadence.ts`). A stale small seed
  once silently neutralized a pessimistic branch mid-campaign — see the pitfalls.

**Production default with override**

- `flemo:settle-gate` = `on`/`off` — render-settle entry gate; default ON for touch
  WebKit (`governedCompiledActive()`), touch Blink, and verified steady-60 desktop
  Blink; off elsewhere. It only protects the START of a flight — a block landing
  mid-flight ages a wall-clocked compiled animation regardless.
- `flemo:snap` = `always`/`off`/`gate`/`hybrid` — player device-pixel snap policy.
  Platform default: WebKit at dpr<3 snaps always; dpr≥3 and Blink use the velocity
  gate.
- `flemo:imgoffload` = `on`/`off` — image decode offloader; default auto
  (`isLegacyAndroidBlink()`).

**Opt-in diagnostics (default off)**

- `flemo:motion-driver-force` = `"raf@<epoch-ms>"` / `"css@<epoch-ms>"` — the driver
  pin. MUST carry the `@<epoch-ms>` stamp (unstamped values are removed on sight);
  expires after 24h. See the force-pin warning contract below.
- `flemo:landing-snap` = `on` — Blink compiled-tier full snap easing A/B.
- `flemo:imghold` = `on` — flight-scoped `<img>` reveal hold.
- `flemo:handoff` = `on` (+ `flemo:handoffms` = number) — anchored-opening handoff.
  On current main, touch-WebKit routing goes compiled regardless, so this reaches the
  player only in pinned sessions (see driver-routing.md, gate 5).
- `flemo:apply` = `scrub` — force the scrub-WAAPI value application for every track.
- `flemo:snapband` = number — the `hybrid` snap's jitter-band width (device px).
- `flemo:layers` = `resident`, `flemo:freeze` = `shallow` — see URL arming below.
- `flemo:preraster` = `on` — park-over + entering content-layer promotion probe.

**Caching contract** (from the registry): the player-side set (`flemo:apply`,
`flemo:snap`, `flemo:snapband`, `flemo:handoffms`, player-side `flemo:handoff`) and
the URL-armed pair are read **once per page load** — toggling them requires a reload.
The engine-routing set (`flemo:landing-snap`, `flemo:imghold`, `flemo:settle-gate`,
engine-side `flemo:handoff`, `flemo:preraster`, `flemo:imgoffload`) is read per
decision — a DevTools toggle takes effect on the next navigation. Every reader degrades
to its default when storage throws (sandboxed/partitioned documents).

### The residual-toggle hazard

Session toggles OUTLIVE the A/B that set them — and on mobile, tab restoration
resurrects `sessionStorage` across _days_. Two real incidents, both costing multi-day
re-investigations:

- A user's `?snap=off` A/B toggle stayed in the session; weeks of "the shimmer is
  back" reports were the toggle itself (found by reading the badge in their screen
  recording).
- A `flemo:lat` seed written by an older build silently defeated a newer build's
  pessimistic branch.

Rules: after ANY A/B round, explicitly clear the keys you set (or use a private
window); when a user reports a regression, **check active overrides first** —
`Object.entries(sessionStorage).filter(([k]) => k.startsWith("flemo:"))`. This is why
the force pin now carries a TTL and a warning.

### The force-pin warning contract

"A forgotten pin must never run silently." Three mechanisms enforce it:

1. `readForcedDriver()` console.warns once per session while a pin is active.
2. `joinPlayer` calls `driverPolicy.pinnedDriver()` unconditionally at entry — even on
   routes that short-circuit before the pin could matter (desktop Blink), so the
   warning always fires. Do not remove that call as "dead"; an e2e test asserts it.
3. Pins expire (24h TTL) and malformed/legacy values are deleted on read.

## 2. URL arming: `?flemo-layers=` / `?flemo-freeze=`

For sessions where you can't open a console (real phones): visiting a URL with
`?flemo-layers=resident` (or `=off`) writes `flemo:layers` for the session at module
load, before the first cached read (`layerSettleHold.ts`); `?flemo-freeze=shallow`
(or `=off`) does the same for `flemo:freeze` (`computeScreenFreeze.ts`).

- `layers=resident` — screen layers stay composited at rest instead of demoting
  `LAYER_SETTLE_MS` after the flip.
- `freeze=shallow` — the direct prev screen stays live (never Activity-frozen);
  deeper screens still freeze.
  Both persist for the session after the URL param is gone — residual-toggle hazard
  applies.

## 3. `window.__flemoPlayerGaps`

The one surviving `window.__flemo*` global: every rAF-player frame gap (ms, rolling
last 600) mirrored at module load in `transitionPlayer.ts`. Read it on-device to see
the player's own clock — `gap max 42ms / miss 3 per 120` class readings are real
starvation (each ~2-3 dropped frames = one visible hitch). The e2e suite reads it
(`motion-perception.spec.ts`); a stalled CI runner is detected the same way. Note it
only populates while the _player_ drives — a compiled-routed session shows nothing.

## 4. E2E helpers (`apps/web/e2e/`)

- `helpers/flemo.ts` — `activeScreen`/`allScreens` (the `data-flemo-*` locators),
  `waitForNavIdle(page)` (waits for no screen in PUSHING/POPPING/REPLACING + 150ms
  grace — **never use fixed waits under the rAF player**: the capped clock honestly
  extends a flight past any constant pause on a stalled runner), and
  `trackConsoleErrors` (filters network 404 noise).
- `motion-perception.spec.ts` — the player-tier guardrails. They pin the player via
  `page.addInitScript(() => sessionStorage.setItem("flemo:motion-driver-force",
`raf@${Date.now()}`))` before the app boots (`openPlaygroundWithPinnedPlayer`); the
  player-mechanics specs `test.skip` on webkit and desktop chromium ("the rAF player
  is production only on touch Blink") and run on the `mobile-chromium` Playwright
  project (Pixel 7 emulation), while the #259 regression guard ("a pinned desktop
  player lands a re-entry on-screen") runs on desktop chromium by design. A `css@…`
  pin test asserts the pin warning text and that the player stayed off. CI's e2e job
  runs `--project=chromium --project=mobile-chromium` (since PR #257).
- `perception/heavy-shell.mjs` — MANUAL motion-energy harness (Playwright video +
  ffmpeg tblend): measures `{ intermediateFrames, freezeMs }` for the content-first
  contract across engine × driver-pin × transition × mount-block matrices. Usage is in
  its header; run against a production build (`next start`), never dev.

## 5. OBSERVATION PITFALLS — read before judging any motion report

Each of these fabricated or masked a symptom during the 2026 campaigns. The postmortem
has the war stories; this is the checklist.

1. **DevTools device emulation renders to a separate scaled surface.** The emulated
   page is composited _into_ the DevTools UI through a generally-fractional rescale:
   moving text shimmers continuously, and post-landing housekeeping becomes visible
   flashes — on a plain window the same build is clean. Weeks were lost to this before
   a phone video showed the device toolbar in frame. `emulationNotice.ts` now warns
   once per session when a transition runs under emulation (Blink + Mac platform +
   maxTouchPoints > 0 — Macs have no touchscreens). **Establish the exact viewing
   configuration FIRST — ask for a screenshot of the whole setup (window vs emulation,
   which display, display scaling) before any code work.**
2. **Residual session toggles** — see section 1. The `?snap=off` incident: the user's
   own A/B toggle, unset for weeks, reported as a regression. Read the badges/toggles
   visible in any user video FIRST.
3. **DevTools FPS meter / `--show-fps-counter` forces continuous presentation.** Viz
   drawing its own overlay every vsync flips Chrome's macOS present pipeline into
   continuous-even mode — the judder being investigated _disappears while you measure
   it_, and the smooth state is sticky until browser restart. (Deliberately usable as
   a machine-level workaround; never as evidence of a fix.) A DevTools Performance
   recording forces frames the same way — it masked the convergence tremor and the
   compositor wake-up loss.
4. **Screencast frame-gap cadence artifacts.** Tab screencast (and Playwright's) does
   not deliver every presented frame; gap patterns in captures can alias into phantom
   periodic "re-rolls" (a "30Hz dither re-roll" reading was partly this). Judge pixel
   phenomena with screenshot-energy probes or a real camera, not screencast timing.
5. **`devtools.timeline` tracing forces per-vsync frames** (observer effect) — trace
   with non-forcing categories (`cc,benchmark`; PipelineReporter args key is
   `frame_reporter`) when frame pacing is the question.
6. **Playwright disables field trials** — a Chrome behavior behind a trial can differ
   from real Chrome; pass `ignoreDefaultArgs` for the relevant switches when that
   matters.
7. **Stale artifact caching when integrating via `file:` tarballs** (consumer-app
   verification): bun caches tarballs _by filename_ — repacking the same version+name
   serves the old bytes; rename every pack (`flemo-core-x.y.z-r2.tgz`, …). Vite's dep
   optimizer keys the served bundle by a `?v=<hash>` that does NOT change when a
   `file:` dep's content changes — the dev server AND the phone's HTTP cache keep
   serving stale flemo (multiple "fix didn't work" verdicts were stale bundles).
   Discipline: after any tarball swap, restart once with `--force` (boot-scoped), then
   **fingerprint the served dep** — find the live URL
   (`curl <app>/src/App.tsx | grep -o 'deps/@flemo_react[^"]*'`) and grep the bundle
   for a marker string unique to the round's change. A version badge in the app does
   not prove flemo-code freshness (source modules transform fresh while the dep bundle
   stales). Also: `curl | grep` cannot see a JS _syntax_ error in injected inline
   scripts — verify probes by executing in a real browser.
8. **rAF-based instruments under LPM/throttling measure the observer, not the
   presentation.** iOS Low Power Mode caps the web process's rendering updates
   (~30Hz) while the compositor presents at panel rate — an rAF HUD reading "even
   8.33ms" or "33ms gaps" says nothing about what the panel showed. Playwright WebKit
   reports `maxTouchPoints=0` even under iPhone emulation, so the touch-WebKit/LPM
   paths cannot be reproduced locally at all — only on glass.
9. **Composite-side phenomena are invisible to DOM instruments.**
   `getComputedStyle`, screencast, and rAF sampling all read the main-thread side;
   swallowed openings and present-pipeline judder live after the commit. When
   instruments say "clean" and the eye says "janky", believe the eye and switch to
   screenshot-energy probes, camera video (a 30fps phone video is decisive more often
   than expected), or frame-extracted screen recordings.
