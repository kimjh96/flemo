# flemo diagnostics reference

For agents and humans instrumenting a device session. Every per-browser decision the library makes is resolved in one place, `packages/core/src/platform/profile.ts`, and pinned per environment by `platformDefaults.test.ts`. This document covers _how to observe a session_ and the pitfalls that cost the 2026 campaigns weeks.

## 0. Start with the flight recorder

Before setting any flag by hand, attach `@flemo/devtools` (playground: `/playground?devtools=on`) and reproduce once. `window.flemo.report()` answers, in one JSON blob, the questions this document otherwise asks you to establish manually: which tier drove each flight, whether the session carries A/B residue, whether the observation itself is trustworthy — and it names the defect classes the 2026 campaigns actually shipped fixes for, so a returning regression arrives as a sentence instead of a hunt.

Two of its sections exist because the campaign learned them the hard way:

- `flights[].motion` — whether the pose ADVANCED, not merely whether frames arrived. Every defect in the 2026-08-18 round (release race, hold re-assert, freeze-then-leap) had clean frame timing while the screen stood still. Timing alone would have called those sessions healthy.
- `judgingProtocol` — the preconditions a verdict needs (DevTools closed, no capture running, real input). A page cannot verify these, so the report states them; a clean report from a DevTools-open session is not evidence. See pitfall #1 below.

## 1. There are no `flemo:*` flags

The library reads **no** `flemo:*` storage key. Every one of the 24 keys core
once read was removed on 2026-08-31, along with the registry that described
them: each was a diagnostic instrument, and each shipped its key string and its
prose into every consumer's bundle. What each key used to force is now a
computed default with no override.

Per-browser behavior is unchanged by that removal, because no consumer ever set
these keys. What changed is that **an A/B on a device is no longer a one-liner**:
comparing two behaviors now means building the branch that has the other one.
Weigh that before adding a key back. The bar the removal set is that a
measurement instrument does not ride in a consumer's bundle to be available on
the one day somebody needs it.

The keys that remain are `@flemo/devtools`' own — `flemo:devtools` (arms the
recorder) and `flemo:devtools-panel-height` — and they live in that package,
which a consumer only installs as a devDependency.

### The residual-toggle hazard, which outlived the flags

Session toggles OUTLIVE the A/B that set them, and on mobile tab restoration
resurrects `sessionStorage` across _days_. Two real incidents, both costing
multi-day re-investigations:

- A user's `?snap=off` A/B toggle stayed in the session; weeks of "the shimmer
  is back" reports were the toggle itself (found by reading the badge in their
  screen recording).
- A `flemo:lat` seed written by an older build silently defeated a newer build's
  pessimistic branch.

Those keys are all inert now, which is exactly why devtools still enumerates
them: a key found on a device reads as an unexplained lead unless something
says it explains nothing. `overrides.warnings` says it, per key, with the
retirement note. When a user reports a regression, read that section first.

## 2. Reading a device that carries residue

`Object.entries(sessionStorage).filter(([k]) => k.startsWith("flemo:"))` still
tells you what a device is carrying, and the recorder reports the same thing
with a verdict attached. Nothing it finds can change how a flight is flown, so
treat every hit as archaeology: clear it and move on.

## 3. `window.__flemoPlayerGaps`

The one surviving `window.__flemo*` global: every rAF-player frame gap (ms, rolling last 600) mirrored at module load in `transitionPlayer.ts`. Read it on-device to see the player's own clock — `gap max 42ms / miss 3 per 120` class readings are real starvation (each ~2-3 dropped frames = one visible hitch). The e2e suite reads it (`motion-perception.spec.ts`); a stalled CI runner is detected the same way. Note it only populates while the _player_ drives — a compiled-routed session shows nothing.

## 4. E2E helpers (`apps/web/e2e/`)

- `helpers/flemo.ts` — `activeScreen`/`allScreens` (the `data-flemo-*` locators), `waitForNavIdle(page)` (waits for no screen in PUSHING/POPPING/REPLACING + 150ms grace — **never use fixed waits under the rAF player**: the capped clock honestly extends a flight past any constant pause on a stalled runner), and `trackConsoleErrors` (filters network 404 noise).
- `motion-perception.spec.ts` — the player-tier guardrails. They pin the player before the app boots (`openPlaygroundWithPinnedPlayer`):

  ```js
  page.addInitScript(() => sessionStorage.setItem("flemo:motion-driver-force", `raf@${Date.now()}`))
  ```

  The player-mechanics specs `test.skip` on webkit and desktop chromium ("the rAF player is production only on touch Blink") and run on the `mobile-chromium` Playwright project (Pixel 7 emulation), while the #259 regression guard ("a pinned desktop player lands a re-entry on-screen") runs on desktop chromium by design. A `css@…` pin test asserts the pin warning text and that the player stayed off. CI's e2e job runs `--project=chromium --project=mobile-chromium` (since PR #257).
- `perception/heavy-shell.mjs` — MANUAL motion-energy harness (Playwright video + ffmpeg tblend): measures `{ intermediateFrames, freezeMs }` for the content-first contract across engine × driver-pin × transition × mount-block matrices. Usage is in its header; run against a production build (`next start`), never dev.

## 5. OBSERVATION PITFALLS — read before judging any motion report

Each of these fabricated or masked a symptom during the 2026 campaigns. The postmortem has the war stories; this is the checklist.

1. **DevTools device emulation renders to a separate scaled surface.** The emulated page is composited _into_ the DevTools UI through a generally-fractional rescale: moving text shimmers continuously, and post-landing housekeeping becomes visible flashes — on a plain window the same build is clean. Weeks were lost to this before a phone video showed the device toolbar in frame. `emulationNotice.ts` now warns once per session when a transition runs under emulation (Blink + Mac platform + maxTouchPoints > 0 — Macs have no touchscreens). **Establish the exact viewing configuration FIRST — ask for a screenshot of the whole setup (window vs emulation, which display, display scaling) before any code work.**
2. **Residual session toggles** — see section 1. The `?snap=off` incident: the user's own A/B toggle, unset for weeks, reported as a regression. Read the badges/toggles visible in any user video FIRST.
3. **DevTools FPS meter / `--show-fps-counter` forces continuous presentation.** Viz drawing its own overlay every vsync flips Chrome's macOS present pipeline into continuous-even mode — the judder being investigated _disappears while you measure it_, and the smooth state is sticky until browser restart. (Deliberately usable as a machine-level workaround; never as evidence of a fix.) A DevTools Performance recording forces frames the same way — it masked the convergence tremor and the compositor wake-up loss.
4. **Screencast frame-gap cadence artifacts.** Tab screencast (and Playwright's) does not deliver every presented frame; gap patterns in captures can alias into phantom periodic "re-rolls" (a "30Hz dither re-roll" reading was partly this). Judge pixel phenomena with screenshot-energy probes or a real camera, not screencast timing.
5. **`devtools.timeline` tracing forces per-vsync frames** (observer effect) — trace with non-forcing categories (`cc,benchmark`; PipelineReporter args key is `frame_reporter`) when frame pacing is the question.
6. **Playwright disables field trials** — a Chrome behavior behind a trial can differ from real Chrome; pass `ignoreDefaultArgs` for the relevant switches when that matters.
7. **Stale artifact caching when integrating via `file:` tarballs** (consumer-app verification): bun caches tarballs _by filename_ — repacking the same version+name serves the old bytes; rename every pack (`flemo-core-x.y.z-r2.tgz`, …). Vite's dep optimizer keys the served bundle by a `?v=<hash>` that does NOT change when a `file:` dep's content changes — the dev server AND the phone's HTTP cache keep serving stale flemo (multiple "fix didn't work" verdicts were stale bundles). Discipline: after any tarball swap, restart once with `--force` (boot-scoped), then **fingerprint the served dep** — find the live URL (`curl <app>/src/App.tsx | grep -o 'deps/@flemo_react[^"]*'`) and grep the bundle for a marker string unique to the round's change. A version badge in the app does not prove flemo-code freshness (source modules transform fresh while the dep bundle stales). Also: `curl | grep` cannot see a JS _syntax_ error in injected inline scripts — verify probes by executing in a real browser.
8. **rAF-based instruments under LPM/throttling measure the observer, not the presentation.** iOS Low Power Mode caps the web process's rendering updates (~30Hz) while the compositor presents at panel rate — an rAF HUD reading "even 8.33ms" or "33ms gaps" says nothing about what the panel showed. Playwright WebKit reports `maxTouchPoints=0` even under iPhone emulation, so the touch-WebKit/LPM paths cannot be reproduced locally at all — only on glass.
9. **Composite-side phenomena are invisible to DOM instruments.** `getComputedStyle`, screencast, and rAF sampling all read the main-thread side; swallowed openings and present-pipeline judder live after the commit. When instruments say "clean" and the eye says "janky", believe the eye and switch to screenshot-energy probes, camera video (a 30fps phone video is decisive more often than expected), or frame-extracted screen recordings.
