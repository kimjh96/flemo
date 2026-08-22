# @flemo/devtools

## 0.3.0

### Minor Changes

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
