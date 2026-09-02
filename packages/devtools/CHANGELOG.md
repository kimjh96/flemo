# @flemo/devtools

## 0.4.0

### Minor Changes

- [`28d0377`](https://github.com/kimjh96/flemo/commit/28d03778381fbd5c761712cf8b827aaf0b60a23e) Remove the `flemo:*` diagnostic flag surface from the shipped library. Core read
  24 session keys and exported the registry that described them, so every key
  string and every explanation shipped in a consumer's bundle; each key is now a
  computed default with no override. `DIAGNOSTIC_FLAGS`, `RETIRED_DIAGNOSTIC_FLAGS`,
  `parkHeadEnabled`, `restLayerPromotionEnabled` and `PlatformProfile.restLayerPromotion`
  are gone from the public API, and the machinery only a flag could arm goes with
  them: the image reveal hold, the REST-time layer promotion, the resident-layer
  and shallow-freeze experiments, and the morph decision trace. Per-browser
  behavior is unchanged, because no consumer set these keys. `@flemo/devtools` now
  lists every engine key as retired residue, so a device still carrying one is told
  it explains nothing.

  Released as a minor rather than a major on purpose: the removed exports described
  a diagnostic surface nothing consumed at runtime, and `@flemo/devtools` mirrored
  the registry through a test-only dependency rather than importing it.

### Patch Changes

- [`472432c`](https://github.com/kimjh96/flemo/commit/472432c6e6c7c951975437fbedf9dc8530e92de2) Keep a screen's pre-raster alive across the head that follows it, so a pushed
  page taller than the viewport no longer slides in blank below the first tile row
  and fill in near the end of the transition on iOS Safari. It applies wherever
  the engine parks a screen: every authored transition, however it hides one, on
  both the entering and the covered side. Set `flemo:parkhead=off` to compare
  against the previous behaviour.

## 0.3.0

### Minor Changes

- [`7b7fdd3`](https://github.com/kimjh96/flemo/commit/7b7fdd3595c8697967b9db56f6aea1aa942b149f) Export the `flemo:*` diagnostic-flag registry from `@flemo/core` as data — `DIAGNOSTIC_FLAGS` and `RETIRED_DIAGNOSTIC_FLAGS` declare every storage key the library reads, its default, and the keys it has stopped reading. It replaces a comment table that had drifted from the code, and it is now held to the readers in both directions: a key read without a row, or a row nothing reads, fails the build.

  `@flemo/devtools` mirrors that registry field for field instead of hand-copying it (its runtime stays dependency-free), so reports name every live flag, state the default an override is departing from, and stop listing the panel's own storage key as unknown. `FlagDescriptor` gains `values` and `fallback`, and its `description` field is now `effect`.

- [`f32c2cc`](https://github.com/kimjh96/flemo/commit/f32c2cc7022dd8d32382420c3a26054546cfaf48) Retire the rAF motion player. Every browser flemo supports already ran the compiled
  compositor tier — Blink, desktop Safari and touch WebKit were each routed there
  unconditionally — so the second driver, its landing pixel-snap, its kind classifier, the
  driver policy and eight diagnostic flags (`flemo:motion-driver`, `-force`,
  `landing-snap`, `handoff`, `handoffms`, `apply`, `snap`, `snapband`) are gone. Authored
  `driver: "player"` pins are no longer accepted; `driver: "native"` keeps its meaning
  (opt into clock surgery for that transition). `@flemo/core` drops 2.8 KB gzipped.

  Devtools reports lose the `driverPolicy` section and instead list retired `flemo:*` keys
  still persisted on a device, marked as inert, so residue is ruled out rather than chased.

### Patch Changes

- [`5b83d3b`](https://github.com/kimjh96/flemo/commit/5b83d3b46ed268ee07e834e7d7819a4e577a1111) Declare the `data-flemo-*` DOM contract in one place. `@flemo/core` now exports the
  whole protocol — every attribute name, the animation hold's values, and selector
  helpers — instead of spreading ~27 string literals across four packages where a
  rename broke the others silently. Consumers styling or querying flemo's attributes
  can import the names rather than hard-code them.

  The contract is now enforced from both ends: core fails its own suite on any raw
  `data-flemo-*` literal, the React binding fails if it renders an attribute core does
  not declare, and the devtools recorder's deliberately-separate copy is pinned against
  core's table.

- [`d15b18a`](https://github.com/kimjh96/flemo/commit/d15b18ad91687a7e564f0f8be54e55554b181adf) Add `flemo:governed`, an override for the governed head kit on touch Blink. The kit is armed by a browser-age probe, so a modern-but-weak phone — a 2022 foldable on a current Chrome — falls straight through it with no way to try it. The key arms or disarms it per session so a device can be measured instead of argued about.

- [`3ddef71`](https://github.com/kimjh96/flemo/commit/3ddef71eed6bd53b2624d190668390295019c9ac) Let the image decide whether the decode offloader runs, not the browser. It was armed by a browser-age probe, and the cost it removes is not created by the browser: a 48px avatar holding a 37-megapixel original is expensive to decode wherever it lands. The offloader already makes the decision that matters — per image, from the source's own bytes — and leaves a well-sized one exactly as authored.

## 0.2.2

### Patch Changes

- [`47332c9`](https://github.com/kimjh96/flemo/commit/47332c92c2b530e4b1fc2426b62dcfb5490b5f69) Retire the iOS Low Power Mode cadence detection. Its treatment — the compiled tier with the governed head — became the default for every touch-WebKit flight, which left the detection gating nothing: a rAF loop running from module load to the end of the session, six more frames per routed flight and a `sessionStorage` seed, all feeding a flag no code read. `lowPowerCadenceActive` is gone from the public surface; `governedCompiledActive` (the predicate the routing actually asks for) stays. The head gate and its keyframes are renamed to say what they mean — `data-flemo-lpm` is now `data-flemo-governed`, and the `-lpm` animation suffix is `-gov`.

## 0.2.1

### Patch Changes

- [`62636e4`](https://github.com/kimjh96/flemo/commit/62636e49274572c7d470f3378b3879fecf82df87) Stop reporting a healthy flight's closing frames as a stall. The recorder
  counted every released frame whose clock and pose stood still, including the
  ones after the animations had already finished and the flight was simply
  waiting to close — so a "motion stalled ~50ms mid-flight" fired on every single
  flight and buried the real ones. Those frames are now counted separately as
  `motion.tailFrames`.

## 0.2.0

### Minor Changes

- [`f07c28e`](https://github.com/kimjh96/flemo/commit/f07c28ed711d08adc85a5fb3e97b297e46eb64ea) Resolve `@flemo/devtools` to an inert entry in production builds. The package now ships `development` / `production` export conditions, so a plain top-level import keeps the recorder and the panel out of a production bundle without the caller writing a dynamic-import guard — the guard was easy to forget, and forgetting it shipped the tool to every visitor silently. `@flemo/devtools/force` resolves to the real tool whatever the build mode, for a staging deploy or an e2e suite that must run against a production build.

## 0.1.0

### Minor Changes

- [`7e7a96b`](https://github.com/kimjh96/flemo/commit/7e7a96b5701818c5c4e251a5d3fa84a5def983ac) Introduce @flemo/devtools: a zero-dependency flight recorder that captures per-transition driver routing, frame pacing, long tasks, landing residues, active debug overrides, and environment/observation-trap fingerprints into a single JSON report for humans and coding agents. Attach with attachFlightRecorder() or ?devtools=on in the playground.

- [`14e0a76`](https://github.com/kimjh96/flemo/commit/14e0a767c83a0a0cb4ebdb14c5e6a46e75437e48) Teach the flight recorder to see the defects that frame timing cannot, and give it a visual panel.

  Report schema v2 adds `flights[].motion` (did the pose actually advance, read from the compiled animation's own clock or the player's inline pose — neither forces a style flush), `flights[].images` (still-loading images that completed mid-flight versus the ones the engine held), `landing.orphanedHolds` (hold markers left on the page at rest), and a constant `judgingProtocol` the page cannot verify but must state: judge with DevTools closed, no capture running, real input. Every one of these guards a defect that shipped during the 2026-08 campaign while rAF ticked at a clean 16.7ms throughout.

  `attachDevtoolsPanel()` mounts a shadow-root panel — floating toggle, flight list, per-flight detail with the findings toned — for the human half of the audience. It is opt-in and mounted by the consumer behind their own dev flag; nothing attaches it for you. It never touches the DOM while a flight is in progress, because an instrument that repaints during a transition reproduces the very artifact it is there to measure.
