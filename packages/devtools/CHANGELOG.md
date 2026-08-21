# @flemo/devtools

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
