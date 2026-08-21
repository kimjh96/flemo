# @flemo/core

## 1.26.0

### Minor Changes

- [`6b1bb93`](https://github.com/kimjh96/flemo/commit/6b1bb93383221c29ba0d630123ca60a7b8f16d30) Hold the first frames of a transition on desktop macOS Safari until the browser
  can actually present them. A compiled clock there starts at the release update's
  style resolution but reaches the glass a pipeline later, so the curve used to be
  entered partway and the motion read as too fast. The screen now waits out that
  latency at its authored start pose, the way touch WebKit already does.
  `flemo:deskhead=off` restores the previous behavior.

- [`d6dab7f`](https://github.com/kimjh96/flemo/commit/d6dab7f398024dd3f9cae885aba9dfa73b48dda6) Release the anim-hold straight onto the DOM on desktop macOS Safari, the way
  touch WebKit already does. That session runs a compiled animation whose clock
  WebKit presents from the main thread, so letting React's render and commit work
  sit between the clock's start and the released attribute cost it the front of
  every transition. `flemo:deskflip=off` restores the previous path.

- [`9685d02`](https://github.com/kimjh96/flemo/commit/9685d020fea2e6f87ee7893a6b3d616cd8cc26bd) Steady the opening and the landing of a transition on iOS Safari. Three changes
  ship on by default there, each measured on a device: the hold's release no
  longer shares its frame with React's reconcile, the held head carries a hair of
  motion so the compositor is already driving the animation when the real motion
  starts, and the entering screen's layer is painted during the hold and kept
  resident at rest instead of being torn down as the flight lands. Sessions can
  opt any of them out with `flemo:relcommit=sync`, `flemo:creep=off` and
  `flemo:layers=off`.

### Patch Changes

- [`9d706dc`](https://github.com/kimjh96/flemo/commit/9d706dcda42aacc4d15262dd76fbe7821a52d541) Stop reading diagnostic toggles from the URL. `?flemo-layers=` and
  `?flemo-freeze=` wrote a session key on any visit, so a link was enough to
  change how the library behaved for the rest of that tab. Both toggles keep
  working through their `flemo:layers` / `flemo:freeze` session keys.

## 1.25.1

### Patch Changes

- [`445e116`](https://github.com/kimjh96/flemo/commit/445e1163cf3b53d31b3b3cd0e19856bcd237aa9e) Arm the render-settle gate by default on desktop macOS Safari. That session runs
  the compiled tier, which WebKit presents from the main thread, so a heavy entering
  screen's mount used to age the animation's clock while nothing was on glass — the
  transition appeared to start already two-thirds finished and then replay from the
  top. The gate now holds the release until the mount settles, so the opening plays
  in full.

## 1.25.0

### Minor Changes

- [`c2aa749`](https://github.com/kimjh96/flemo/commit/c2aa749a4064ebe68f22bc2ad4e7f8f88c0d41bb) Fix a React hydration mismatch on server-rendered screens: the scope's
  `will-change: transform` promotion is derived from browser-only state
  (`flemo:preraster`, the steady-60 desktop profile), so it is now deferred past
  hydration instead of being evaluated in the hydration render — the server HTML
  and the first client render always agree, and the promotion still lands before
  any transition can start. Core exports `readLayerPromotionFlag`, the single
  predicate both halves of that decision now read.

## 1.24.0

### Minor Changes

- [`30c2a54`](https://github.com/kimjh96/flemo/commit/30c2a5428e3561aa0d43295df852031c02975e39) Add optional shared top and bottom bar IDs so only semantically matching bars hand over in place. Reuse matching partner measurements and synchronously reserve newly measured bar heights before paint, while retaining the legacy position-only behavior when IDs are omitted.

- [`707442e`](https://github.com/kimjh96/flemo/commit/707442e1ec67612f016aba93685750dc21a32541) Add an in-flight display-cadence probe that verifies steady-60Hz desktop sessions. The first flights of a session measure the panel while a compositor animation is live (the only moment an adaptive 120Hz panel shows its true rate); two verified ~60Hz flights mark the session steady-60, and a single high-refresh reading latches it off permanently. Desktop Blink routing itself stays on the compiled compositor tier (the settled verdict of on-device judging), and the verdict instead arms desktop-profile defaults: the render-settle gate, the unpainted-only image hold, and the compositor warm-up. The settle gate's give-up path now also rides two consecutive fast frames before releasing, so a pop's returning screen, whose unfreeze re-uses its DOM and never trips the mount-commit detector, has its style/layout block absorbed into the hold instead of stuttering the flight's opening. Behavior at 1x density, on high-refresh panels, and on touch devices is unchanged.

- [`b495c99`](https://github.com/kimjh96/flemo/commit/b495c99651e2eb73f720d2f802525b538a782c95) Scope the image-decode offloader to legacy Android Blink instead of running it on every device. A touch Chromium that ships no UA-CH brands (device-confirmed Galaxy Note 9 Samsung Internet) is confidently pre-2021, GPU-starved hardware whose oversized-image decode stalls the transition opening on re-entry; the offloader now auto-engages there and downscales only its genuinely oversized `<img>` sources. Modern devices (which ship UA-CH brands) and iOS are excluded, so a flagship is never touched, and `flemo:imgoffload` still overrides both ways (`on` forces it anywhere, `off` opts a legacy device out). Exposes `isLegacyAndroidBlink` from `@flemo/core`.

- [`945eaba`](https://github.com/kimjh96/flemo/commit/945eabace0200a7693271e9433e28da62f2e848a) Fix the pop-convergence round: post-landing layer demotions now wait out any
  in-flight navigation (the intermittent mid-pop stall), the player's
  perceptual cut lands its final pixel on the cut frame instead of the
  COMPLETED flip, and a navigation force-concludes swipe settles on its
  participants — a tap grazing the swipe-back edge no longer fights the pop it
  triggered. Desktop WebKit and desktop Blink now ride the compositor-driven
  compiled tier deterministically, with the landing governor expressed as an
  easing reshape. The image decode offloader holds re-entry reveals to the
  flight's rest, and the playground's baked gradient is scoped to Blink (the
  swap itself was Safari's first-entry blink). On iOS, Low Power Mode is now
  detected (a regular ~33ms rAF cluster, isolated from the player's learned
  interval, persisted per session) and single slide navigations route to the
  compositor-driven compiled tier with the birth anchor and stall watcher
  armed — rAF is capped at ~30Hz under LPM while the compositor keeps the
  panel rate, so transitions stay smooth instead of half-density.

- [`707442e`](https://github.com/kimjh96/flemo/commit/707442e1ec67612f016aba93685750dc21a32541) Fix the live-judged desktop Chrome jank sources found in the 2026-08-18 campaign: hold the warm side's still-loading images too (a leaving list's lazy avatars were decoding onto the sliding layer, one skipped present per decode), make image holds single-owner (an overlapping hold captured another hold's display:none as the "original" and blanked already-loaded avatars), exempt held images' style channel from the arrival hold's in-place freeze (it was undoing the hold mid-flight and resurrecting the hide at rest), widen the GPU pipeline prewarm scene to the draw variants real screens use (image texture under a circular clip, gradient, CJK text, hairline border, shadow; cold-profile first flights carried 120-150ms of in-flight pipeline compiles), and keep a 2KB always-on 60fps video surface on steady-60 desktop sessions so the display pipeline holds a steady compositing cadence between and during flights. Desktop routing is settled on the compiled tier; the steady-60 verdict now gates desktop-profile defaults only.

- [`b6c62f6`](https://github.com/kimjh96/flemo/commit/b6c62f67569a5cb5901e7de7ad9536eeefb0a3e9) Route Blink to the compiled tier everywhere. Desktop Blink already did; touch Blink defaulted to the rAF player and reached the compiled tier only by demotion — two stalled flights, persisted per origin, and re-probed once per session, so the first flight after every page load ran the player even on a device whose ledger already said "css". A weak phone's behavior therefore depended on which origin it had visited and how recently it reloaded. Blink is now one rule from the first flight, and demotion is off everywhere since its only purpose was reaching a tier Blink now always uses. WebKit is unchanged: there the compiled tier swallows its opening and the player stays device-verified. The `flemo:motion-driver-force=raf` pin still pierces.

### Patch Changes

- [`9b16d8f`](https://github.com/kimjh96/flemo/commit/9b16d8fcd5b267b0e8865001c8db505be56814cf) Fix the COMPLETED cleanup leaving a stale pose on the landed screen: when another inline lease survived the flip (the governed easing stamp), the entering screen could stay parked at its from-pose — on a raf-pinned desktop session this presented as a fully blank viewport after a push→pop→push re-entry. The landed scope's transform/opacity are now stripped explicitly at COMPLETED, and the raf force pin can pierce the desktop compiled gate again for diagnostics (default desktop routing is unchanged).

- [`cec6ab6`](https://github.com/kimjh96/flemo/commit/cec6ab66d6334fe8203ea304fe496ff6849fa559) Remove dead diagnostic instrumentation (the write-only `window.__flemoRoute`/`__flemoOpenings`/`__flemoSeam`/`__flemoHandoffs`/`__flemoParked` globals and the unused `flemo:compiled` and `flemo:native` toggles) and consolidate the surviving `flemo:*` debug flags into one documented registry (`diagnosticFlags.ts`). No behavior change — every shipped default, storage key, and per-page-load caching contract is preserved, and `window.__flemoPlayerGaps` keeps working.

- [`0473551`](https://github.com/kimjh96/flemo/commit/0473551b5911d203ae7984ba53623baa6268396b) Stop the `driver=raf` force-pin from routing desktop Blink onto the rAF player. The player has never driven a non-touch flight; device-reproduced, after a re-entry (push→pop→push) it leaves the entering screen pinned at its from-pose (`translateX(100%)`) — the birth/play never fires — so the screen sits entirely off-screen and the viewport goes blank. Desktop Blink stays on the compiled compositor tier, which completes cleanly.

- [`de35c13`](https://github.com/kimjh96/flemo/commit/de35c13ae4639ef42627b213f74f6387d5ce3745) Add an opt-in image reveal hold (`flemo:imghold=on`) — the `<img>` analog of the response hold. During a flight, an entering screen's still-loading images are held invisible and revealed in one batch at rest, so an image that completes over the network mid-slide can't re-raster the sliding layer and starve the animation. Image decoding still proceeds during the hold, so the reveal is a cheap composite in the quiet window rather than a mid-flight raster. Off by default while it's verified on-device.

- [`20744c0`](https://github.com/kimjh96/flemo/commit/20744c0f2ed1bcfd8d50a5c4b6c9fb52bc7d9226) Hold `<Part>` elements that live outside any screen for the flight's hold window. The compiled hold rule only pauses held elements and their descendants, so a Part in persistent chrome beside a `<Slot>` (or in a portal) kept animating while every screen was parked, then led the flight by the entire hold. The engine now stamps the hold on those parts directly, scoped by the owning Router and owned by the active side so two screens cannot fight over one persistent element.

- [`88c5cff`](https://github.com/kimjh96/flemo/commit/88c5cff30f3edd580b4a52513e287aa1c082882f) Make the `driver=raf` force-pin actually drive the player on desktop Blink. The desktop/high-refresh gate (`maxTouchPoints === 0 || …`) fired before the pin was honored, so a pinned session silently stayed on the compiled tier there — leaving the player+per-frame-snap path (the only tier that can quantize a HiDPI transform to device pixels every frame and kill the sub-pixel convergence shimmer) unreachable on desktop even when explicitly pinned. The pin now bypasses this gate, same as it already bypasses the native-kind choice.

- [`14923eb`](https://github.com/kimjh96/flemo/commit/14923eb8d7f6c9c3574d8c95db606ff190b2ca54) Raise the player's learned frame-interval floor from 240Hz to 600Hz so its cadence estimate can track the fastest panels now shipping (consumer esports monitors reach ~540-600Hz). The old floor clamped a genuine high-refresh desktop down to 240Hz, leaving the pacing heuristics (jitter thresholds, pixel-snap budgets) calibrated for a slower display than the panel really is. The estimate is a median, so widening the floor doesn't reopen the jitter-fakes-a-fast-panel hole the floor guards against.

- [`de35c13`](https://github.com/kimjh96/flemo/commit/de35c13ae4639ef42627b213f74f6387d5ce3745) Fix rapid navigation swallowing the transition on the compiled tier, and steady Chrome's ProMotion frame pacing during compiled flights.

  A stale resolver (a finished flight's animationend/cancel firing a frame into the next one) could resolve the CURRENT task instead of its own, flipping `data-flemo-status` to COMPLETED at the exact frame the new flight released its hold — un-matching the running `@keyframes` rule and cancelling the slide mid-opening, so a fast Next/Back burst committed the navigation but showed no motion. Each flight now resolves only its own captured task, so a late resolver can never cut a newer flight.

  Separately, a compositor-driven flight left the main thread idle, and Chrome then paced its macOS ProMotion presentation unevenly (dropped/duplicated frames mid-slide, read as convergence trembling). A lightweight frame-pacing keepalive now holds a live frame source across compiled Blink flights so the panel stays at its full refresh rate.

- [`b6c62f6`](https://github.com/kimjh96/flemo/commit/b6c62f67569a5cb5901e7de7ad9536eeefb0a3e9) Remove the stall-demotion machinery from the driver policy. It moved a chronically-starved Blink device onto the compiled tier, and Blink now starts there, so it had nothing left to decide: the per-run gap accounting, strike counting, the irreversible in-session demotion and the persisted `flemo:motion-driver` ledger with its probation probe are gone. The force pin is now the only input to driver selection. Player frame gaps are still reported to the registry's diagnostic hook.

- [`2be1e05`](https://github.com/kimjh96/flemo/commit/2be1e05a6d18883830edeaffbe5db7d724ebb204) Retire the LPM release-latency ledger. The probe armed on every low-power-supervised flight and persisted a session-worst value to `flemo:lat`, but no production code ever read it — the birth hold is sized from a static table, so the "adaptive" hold was always the static guess. Removing it drops an observer per flight on the weakest devices in the matrix and one more persisted ledger that can go stale between builds.

- [`6d6dae8`](https://github.com/kimjh96/flemo/commit/6d6dae8f98b159d3faa5b0b57a637288fffc6c53) Keep transition-adjacent scrolling responsive and reject cross-axis touch jitter before page-wide swipe-back can claim or cancel into an unintended pop.

  During push and replace transitions, Flemo suppresses `click` activation for React handlers and native click listeners below the React root. Listeners above the root, plus lower-level pointer and mouse events, remain observable so the browser can preserve native scroll targeting across the transition.

- [`6d3cc23`](https://github.com/kimjh96/flemo/commit/6d3cc238755a1a7d2d25edbf9113ea7c27fc571e) Default the render-settle entry gate ON for touch Blink. The pop-convergence round proved on a Note 9 that a heavy mount commit stalls even the compositor's initial layerization — gating the release past that task measurably helped — and widened the gate's arming to every engine on that evidence, but the flag that enables it stayed WebKit-only, so Android kept running ungated. The gate stays adaptive (no qualifying mount commit inside the first wait releases with no felt delay), and `flemo:settle-gate=off` still opts out.

- [`bfd077a`](https://github.com/kimjh96/flemo/commit/bfd077a0b67181da88f73d46ccadcff73b7ff65d) Export `TaskManager` as the correctly-spelled alias of the historical `TaskManger` export (which remains for compatibility).

## 1.23.0

### Minor Changes

- [`490b0e4`](https://github.com/kimjh96/flemo/commit/490b0e420429b828011c7092c549f52258beae80) Motion driver overhaul hardening: device-verified fixes across five external review rounds plus two device-measured features.

  - Response hold parks every fetch method (reveal queries arrive as POST RPCs and HEAD counts too), never streams, with the self-release backstop bound to the whole choreography's span.
  - Owner-scoped, composable holds: layer settle holds refcount per-instance tokens and compose requirements as a union over the element's own inline values; inline writes and settle execution are writer-scoped leases; the owner-less force form remains the flight-over authority.
  - Blink detection via the UA-CH Chromium brand (WebKit's userAgentData no longer misreads Safari); stall strikes judged at each run's final measured cadence, so a genuinely slow display never demotes the player.
  - Player correctness: per-track writer tokens, sustained slow-cadence clock adoption with next-flight seeding, authored transform order preserved (non-canonical or padding-incompatible motions fall to the scrub tier), and the navigation resolves on the player's own clock once every track finishes.
  - Whole-choreography completion on every path (gate, floor, perceptual cut, early landing, screens-motionless case), with participants scoped to one Router's flight via explicit `data-flemo-router` markers stamped by the React binding on screens, shared bars, and parts.
  - Async image decode for flight participants: `decoding="async"` stamped on a transitional screen's images (and arrival-held content just before reveal) unless the consumer authored one — a device-measured 37MP portrait no longer freezes mid-flight.
  - Platform-density snap default: WebKit below 3x snaps every frame (desktop texture-resampling sizzle, device-judged), phone densities and Blink keep the velocity gate; plus opt-in resident-layer and shallow-freeze diagnostics.
  - Native first-frame hold disposes its backstop and stale callbacks; GPU prewarm is Blink-gated, refcounted, and deferred while a flight is active; landing snap honors sub-1 device pixel ratios.

## 1.22.1

### Patch Changes

- [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e) Land the in-flight arrival hold inside the transition's sub-pixel tail instead of after the COMPLETED flip. Once every participant of the choreography is within one CSS pixel of rest, the held content reflects while the compositor still owns frame production, keeping the release commit's layout and paint cost out of the settle window; unanalyzable choreographies keep the deferred post-COMPLETED landing.

- [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e) Align the cupertino preset's kinematics with the measured native iOS navigation transition — 30% parallax on the covered screen (was 35%) and a 10% dim (was 20%) — and lengthen the glide to 0.7s (was 0.6s) on the same UIKit-spring bezier. The perceptual analyzers now ignore channels held constant across a variant, so a constant decoration never disables the completion cut.

- [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e) Derive every transition deadline from the authored choreography instead of fixed constants: the task gate's ~1.2s backstop silently cut any longer authored transition mid-flight, and the choreography deferral's 1s cap cut any part authored more than a second past its screen. The gate, the liveness floor, and the deferral now all scale with the full choreography span (active, passive, and parts alike) plus the recovery margin — an authored duration of any length plays in full, and the backstops only ever fire on a genuinely stranded task.

- [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e) Hold invisible consumer animations for the flight. An animation running inside an opacity-0 subtree (a delayed skeleton reveal and its shimmer layers) forces the compositor to create and raster every layer of that subtree the moment it becomes visible — mid-flight, that is a visible twitch. Such animations now pause while the screen is in motion (indistinguishable on glass — their output cannot be seen) and resume with the arrival-hold release at the choreography's rest point; visible animations are never touched.

- [`c0a878d`](https://github.com/kimjh96/flemo/commit/c0a878d936c2f9057fbd4f9817710ff58402d86e) Re-anchor the covered screen with the active one on main-thread stalls. The native stall re-anchor only shifted the active scope's participants, so on engines that present from the main thread a stall resumed the entering screen smoothly while the covered screen's parallax teleported the stalled span in one frame (the visible parallax snap on mobile Safari). The watcher now shifts every sibling screen's timeline in the same breath, with overlapping watchers deduplicated per frame.

## 1.22.0

### Minor Changes

- [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0) Split the screen-freeze decision into three modes (`computeScreenFreezeMode`): a DEEP screen (below the direct prev) freezes in the same commit that re-ranks it, only the just-covered screen's freeze keeps the quiet-window deferral, and participants wake immediately. Deferring deep freezes let a rapid push storm accumulate 15-20 live full-screen layers (no quiet window ever arrived), flickering and janking the whole app at depth — a regression introduced with the freeze deferral.

- [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0) Choose the motion driver per transition kind, measured from the authored keyframes: a transition whose screens move fast (peak translation ≥ 6 CSS px/frame, percentages resolved against the real screen box) runs on the native compiled-CSS clock even on engines that default to the rAF player, while fades, drifts, and unanalyzable choreographies keep the player. One navigation always runs on one driver, and a new `driver: "native" | "player"` transition option lets authors override the measurement.

### Patch Changes

- [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0) Widen the clean-end landing deferral from two to four frames so the COMPLETED flip's commit starts after the motion's final frames have cleared the presentation pipeline — measured on WebKit (main-thread presentation), the ~30ms flip commit at write+2 frames still delayed a pop's deceleration tail.

- [`9a98052`](https://github.com/kimjh96/flemo/commit/9a98052e826200d9ed98c213c95f847e774e4bc0) Cap the player clock's advance at two frames per gap: a 40-100ms main-thread block used to slip under the old 100ms re-anchor cliff and fast-forward the authored curve in one frame (the screen "whooshing" ahead of its easing). Any stall now resumes at most two frames past where it stalled and the curve plays out in full.

## 1.21.1

### Patch Changes

- [`b85b941`](https://github.com/kimjh96/flemo/commit/b85b9417bdf0aa65ab2f2ebafe157e75f419464e) Defer a clean transition end's COMPLETED flip by two frames so the last motion frame presents before the convergence commit (status re-renders, freeze, animation strip) lands — removing the dropped frame measured right at landing. Recovery paths still resolve immediately.

- [`b85b941`](https://github.com/kimjh96/flemo/commit/b85b9417bdf0aa65ab2f2ebafe157e75f419464e) Hold the content-settle gate through React's suspense reveal throttle, keyed on state rather than timing: while the entering screen is still an animated skeleton (shimmering placeholders, nothing fetching, nothing mutating) the gate keeps waiting for the reveal commit, bounded only by the settle cap, and the anim-hold backstops now outlast that cap instead of firing underneath it. A de-shelled scope with nothing pending then releases on a two-frame anchor, so the reveal lands before the motion starts without paying the full quiet window.

- [`b85b941`](https://github.com/kimjh96/flemo/commit/b85b9417bdf0aa65ab2f2ebafe157e75f419464e) Count the entering screen's first-screenful image loads as in-flight work in the content-settle gate: an incomplete eager image now holds the motion (under the same settle cap) the way a pending fetch does, so image paints land before the flight instead of stealing a frame during it. Below-the-fold and not-yet-started lazy images are skipped.

## 1.21.0

### Minor Changes

- [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f) Enter complete on pushes: a freshly-mounted PUSH destination whose requests are still in flight waits (bounded) for its first content wave to land and settle before the motion starts, so a cold navigation slides in already filled instead of assembling mid-flight. Replaces (bottom-tab switches), warm entries, and pops pay nothing.

- [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f) Remove the consumer-animation quarantine: the compiled sheet no longer sets `animation: none` on the consumer's own elements and `::before`/`::after` pseudo-elements inside entering screens. Consumer-authored animations (skeleton shimmers, ambient loops) now run exactly as written during transitions.

- [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f) Engine-scoped motion driver: on non-Blink engines the rAF player drives every screen transition on one shared clock; Blink keeps the compiled compositor path. WebKit presents compiled CSS animations from the main thread, so a fetch commit landing mid-flight eats the remaining span and the transition snaps; the player's re-anchoring resumes from the freeze and plays the remainder, delayed but complete.

- [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f) A replace arriving mid-transition now supersedes the in-flight transition (fast-forwards it and starts immediately) instead of being silently dropped. Rapid bottom-tab switching no longer swallows taps that land inside the previous tab's flight, and lag no longer accumulates behind queued fades.

### Patch Changes

- [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f) Pre-warm the compositor while the user interacts. The per-flight warm-up starts with the flight, so the first navigation after an idle period still paid the pipeline's wake-up inside its opening frames. The warm-up now rides any interaction (pointer movement, wheel, touch, keys) — a pointer moving toward a tap precedes it by seconds — renewed at a throttled cadence and released shortly after interaction stops.

- [`372c03c`](https://github.com/kimjh96/flemo/commit/372c03cadb82160e58bd2d70750543c00acb766f) Warm the compositor for the length of every flight and decode oversized images off the main thread. Fixes the one-frame opening judder on cold transitions and the WebKit tab fade being swallowed when a fetching screen's image decode lands inside the flight.

## 1.20.0

### Minor Changes

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) Hold in-flight content changes until the screen is at rest. A cold navigation's async data can land mid-flight — section swaps, streamed additions, and in-place text/attribute updates — while the screen is still decelerating, which reads as mid-transition stutter. The engine now parks departing nodes, holds arrivals off-glass, and reverts in-place writes during the flight, reflecting everything in one commit at COMPLETED (or the instant the transition is interrupted) — the shipped delayed-but-complete contract extended from mount time to flight time.

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) Suspend consumer CSS animations (pseudo-elements included) inside a navigation's freshly mounted entering screen (push/replace), starting them when the screen arrives; `<Part>` elements are exempt, and the visible exiting screen and the pop destination are untouched (a pop destination's animations restart at the unfreeze commit under the flight's own motion). A cold first entry can mount hundreds of animated placeholder shimmer layers whose compositor commit swallows the whole transition window — measured on an iPhone as a fade presenting zero intermediate frames. With the quarantine, a first entry plays the intended transition identically to re-entries.

### Patch Changes

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) Complete a navigation when its whole choreography completes: a passive side or `<Part>` whose registered motion outlives the active screen's animation was truncated mid-flight by the COMPLETED flip at the active animationend (visible as the part snapping right at the convergence). A clean end now defers the task resolution by the difference, bounded, so the full choreography plays; the perceptual cut composes with it (a part resolves at its own sub-perceptual point).

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) Make the compiled compositor animation the default screen-transition driver on every engine, with no automatic or mid-flight driver switching. Per-frame screencast diffing on real Chrome showed the rAF player's px-snapped writes shiver at the deceleration tail (hold/1px-step alternation) while translate3d-compiled keyframes decay monotonically to rest — the Blink judder the player was built to route around no longer exists — and under CPU throttle the compositor plays every fade on time while a main-thread player collapses. The player remains available behind the `flemo:motion-driver-force` pin for diagnostics; the pin is now session-scoped (sessionStorage), and a legacy localStorage pin is removed and never honored.

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) Keep the convergence frames light. Resting screens deeper than the transition pair no longer re-render on status flips (previously an O(depth) re-render plus attribute-write storm landed exactly on the final frames of every navigation), and the in-flight landing now presents two frames after COMPLETED instead of inside the convergence commit — with an immediate land if a new navigation starts first.

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) Resolve reveal-shaped transitions (static enter over an animated exit) on the passive side's motion span, keeping the navigation task anchored to the visible motion instead of resolving on a microtask.

- [`46aec20`](https://github.com/kimjh96/flemo/commit/46aec20c5f4d88a0db769dab9e998ba7c663fed6) End a transition the moment its remaining motion drops below one device pixel (and one opacity step) on every animated channel, computed analytically from the easing curve. The asymptotic tail of a deceleration curve spends 150ms+ moving sub-pixel distances, which presents nothing but forces per-frame text re-rasterization at shifting anti-aliasing phases — visible as a fine shimmer at the convergence on scaled display pipelines. The cut presents pixels identical to the authored motion, includes every participating `<Part>`'s registered timing in its ceiling, stays inside the natural animation span, and yields to the recovery machinery (cancel-resume, watchdog) whenever the clock shifts.

## 1.19.1

### Patch Changes

- [`d979a33`](https://github.com/kimjh96/flemo/commit/d979a33db7642e70bb3687cd12593b789c7dcc39) Revert the shell-first children deferral and re-anchor the transition gate to the motion start. Screens enter with their real content in the first frame again — no blank shell, no late content pop-in, no perceived double render. A heavy mount commit now delays the transition start by exactly its cost instead of snapping the transition away: the gate backstop re-arms while the hold is pending and restarts with a full window when the motion actually begins.

## 1.19.0

### Minor Changes

- [`b7096b0`](https://github.com/kimjh96/flemo/commit/b7096b04e4d181389db5f2af7bd9c6f76688e3a8) Start transitions against the screen shell: a screen mounting into a push or replace now renders its frame first and mounts consumer children in a deferred commit once the transition's first frame has painted, so heavy content can no longer freeze or swallow the animation. The rAF player also re-anchors its clock across long main-thread stalls, resuming motion instead of fast-forwarding to the end. `@flemo/core` gains a `shouldMountShellFirst` export so the shell-first decision stays framework-neutral, a new public API that lifts core to a minor bump.

## 1.18.1

### Patch Changes

- [`c2ddae3`](https://github.com/kimjh96/flemo/commit/c2ddae3e4ea6ade5cc5ee2c9651c152bb2f2232d) Survive browser-cancelled transition animations on every participant: when a mid-transition commit makes WebKit silently cancel a running screen, decorator, bar, or part animation, the engine now resumes it on its original timeline (negative-delay rejoin) instead of losing the exiting screen's fade or cutting the whole transition to a single-frame swap after one retry.

## 1.18.0

### Minor Changes

- [`4214525`](https://github.com/kimjh96/flemo/commit/4214525eba426cf29c3f00adeb404126c9cd6b67) Pair-release the anim-hold for every navigation (push and replace included, not just pop), scope the image-decode wait to screens actually waking from a freeze so the pairing costs nothing, and teach the transition engine to recover a cancelled screen animation (restart once, then a duration-based watchdog) instead of hanging until the 1.2s task gate and snapping with no transition.

## 1.17.0

### Minor Changes

- [`980af25`](https://github.com/kimjh96/flemo/commit/980af254371f322d1a7bdbbc657d449e6be464ed) Release the anim-hold of both screens of a pop together: a transition-scoped barrier (`createAnimHoldCoordinator`) waits for the pair's slowest readiness gate, so the revealed screen's image-decode wait no longer lets the exiting screen start first and the pop pair always moves on one clock, still bounded by the existing 300ms backstop. Push and replace timing is unchanged.

## 1.16.1

### Patch Changes

- [`15ab16b`](https://github.com/kimjh96/flemo/commit/15ab16b5c2dc0e8b015f965c8871358a9fc26532) Make <Part> motion natural across a swipe. Cleanups (COMPLETED strips, unmounts) now drop any in-flight settle without writing, so a late settle can never shadow the rest rules, and a committed swipe keeps the previous side's part landing values in place instead of stripping them a frame early (the engine's COMPLETED cleanup owns the strip). The playground's panel-title Part gains the reference swipe hooks: the returning screen's title recovers with the drag progress and settles the remainder on release, matching how the screens themselves move.

## 1.16.0

### Minor Changes

- [`39bc7ea`](https://github.com/kimjh96/flemo/commit/39bc7eab906cb785a50405be7ea7438f0e6c4293) Scope the motion-driver default to the rendering engine. The compositor defect the rAF player routes around was measured on Blink specifically, while a main-thread player starves WebKit's weaker mobile main threads (eye-confirmed janky on Safari, worst on iOS) whose compositor never had the defect. The player now defaults on only for Blink; WebKit and other engines keep the compiled compositor paths (CSS animations for transitions, CSS transitions for swipe settles) that served them before. The measured demotion policy and the diagnostic force key remain supreme on every engine, and nothing changes for Chromium users.

## 1.15.0

### Minor Changes

- [`1a21cfc`](https://github.com/kimjh96/flemo/commit/1a21cfc94a8a01fba0e920fa179e67e4d0d84448) Put the last two compositor-clocked motions on the player's clock. Swipe releases (the settle after a gesture lets go) now run as scrubbed single-keyframe Web Animations — the browser fills the start from the element's current position, exactly like the CSS transition they replace, while a shared main-thread clock steps every settling participant together; a new write to a settling element pins its current values first, so a re-grab takes over seamlessly. <Part> elements now join the navigation's shared player alongside their screen, bars, and dim, each with its own registered motion. Where WAAPI is unavailable the previous CSS paths remain byte-for-byte in charge, and settle frame gaps are deliberately excluded from the driver policy's demotion statistics (a release routinely overlaps the commit it triggers). The playground panel titles gain a "panel-title" Part demonstrating both.

## 1.14.0

### Minor Changes

- [`8236d28`](https://github.com/kimjh96/flemo/commit/8236d28865712207b02b5b701bbb9aab6f6405af) Extend the rAF player to EVERY motion a transition can declare. Values the numeric interpolator cannot pair (clip-path morphs across templates, calc() expressions, mixed units, one-sided properties) are now driven by a scrubbed Web Animation: created paused, its currentTime stepped every frame from the same shared clock, so the browser interpolates with exact CSS semantics while the progression stays main-thread-driven — the same compositor-jank immunity as the numeric tier, for built-in and user-authored transitions alike. The compiled CSS path remains only for replay chains, policy-demoted devices, and environments without WAAPI. The playground gains a "Wipe" transition whose mismatched clip-path templates exercise this tier end-to-end.

## 1.13.0

### Minor Changes

- [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713) Retune the cupertino preset: 0.6s both ways (was 0.7s enter / 0.6s back), a deeper -35% parallax on the receding screen (was -30%, mirrored in the swipe-back handlers), and a lighter rgba(0,0,0,0.2) dim (was 0.3), with the overlay decorator kept in lockstep at 0.6s.

- [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713) Pre-rasterize the PUSH-entering screen during the anim-hold ("park-under"): a screen entering from fully off-screen has no rasterized tiles, and Chromium then rasterizes them as the slide reveals — on raster-heavy content that froze a presentation frame mid-motion (a visible "tick"). The entering screen now parks at its destination beneath the previous screen for the hold window (container-level stacking demotion, gated on that screen's verifiably opaque surface, with the paused hold as fallback) and then replays its animation over the already-rasterized layer. Also restores the decode-wait wiring in the React binding — the scope was accidentally dropped in a refactor, shipping the image decode-wait dormant.

- [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713) Drive transition motion with a single-timeline rAF player instead of compiled CSS animations. Chromium's compositor-driven animations (CSS keyframes and WAAPI alike) intermittently miss presentation deadlines on raster-heavy layers — invisible to every JS metric and unfixable from CSS — while main-thread-driven transforms stay smooth (screen-recorded, single-variable A/B). All participants of one navigation (entering and exiting screens, dim decorator, riding bars) now step off one shared clock, x/y values snap to device pixels while moving at least one device pixel per frame (crisp leading edge without the compositor's erratic snapping) and glide unsnapped below that speed (snapping sub-pixel motion quantizes it into the end-of-transition shivering), and the anim-hold/park/decode pipeline gates the start exactly as before. Variants the player cannot provably interpolate (mismatched value templates such as clip-path morphs) keep the compiled CSS animation path unchanged, and a device whose main thread chronically starves the player (measured by its own frame gaps) earns a persisted demotion back to the CSS path — the library observes and decides; there is no consumer API.

### Patch Changes

- [`8c084ba`](https://github.com/kimjh96/flemo/commit/8c084ba038f9e8f445844f9e108bcf15faa3c713) Compile x/y offsets to translate3d instead of translateX/translateY (keyframes, entering initial styles, and inline swipe animations alike). Chromium pixel-snaps a 2D-transform-animated layer when its content rasters heavily, repeating a frame roughly every six and catching up with a double-length jump — a visible stutter across the whole transition on gradient-heavy screens. The 3D form routes the layer through texture-filtered compositing, which glass-recorded A/B shows sliding monotonically to rest. WebKit behaves identically for both forms; curves, timings, and the API are unchanged.

## 1.12.1

### Patch Changes

- [`1d2edf0`](https://github.com/kimjh96/flemo/commit/1d2edf012f5030fa8c834a59c9c49ee500d8a30f) Make rapid and cross-zone back/forward bulletproof. Transition-gated tasks now carry a gate backstop, so a transition whose `animationend` is lost (screen frozen or torn down mid-storm) can no longer deadlock the navigation queue. The history sync gains a convergence pass that replays the browser's present entry through the normal classifier once traversals go quiet, so the content always reaches the URL. A traversal landing multiple entries below replays each screen as its own transition instead of dropping the ones in between. Transition definitions are reference-counted, so a frozen Router instance cleaning up no longer strips the definitions a sibling zone is still animating with (the "screens stop transitioning until something remounts" bug). And a nested Router's scope AND history sync now persist for the session across zone exits: a zone that is offscreen still hears traversals and applies them instantly, so it is already on the right entry whenever it is revealed — re-entering a zone resumes animated navigation instead of degrading to instant restores. A nested Router's URL-reflection is also fenced to its own zone: an effect flushing after the browser has already traversed to a foreign entry (backing to home mid-storm) can no longer rename that entry to the zone's seed URL — the permanent "address bar says one zone, screen shows another" corruption.

## 1.12.0

### Minor Changes

- [`51c9eac`](https://github.com/kimjh96/flemo/commit/51c9eacf9afcf68dcc1731e3d7fee5b443e7d9e6) Replay every queued back/forward traversal with its full transition — late but complete — restoring the pre-1.5.7 feel. Folding now happens only when this Router has rewritten the browser timeline since the event fired (a push truncated the forward stack, a replace swapped an entry): only then can a stale event reference a destroyed entry, which is the one case where replaying corrupts (proven by the convergence property test). A remounting Router also seeds with the present entry's identity instead of a generic root, so traversals back onto it match instead of being swallowed.

## 1.11.0

### Minor Changes

- [`bce265d`](https://github.com/kimjh96/flemo/commit/bce265d3e4b50823d3f557872e052ced5b4a72fe) Make history synchronization identity-based and convergent, fixing the duplicate-screen crash and skipped transitions under rapid back/forward. Traversals now classify by entry identity (entries we hold pop with their animation, gap jumps included) with browser-space frame stamps for direction; queued events coalesce to the browser's present entry so storms collapse into one converging transition; and queued in-app navigations align the stack to the entry the user actually saw (and abort entirely when their Router has since unmounted) before acting. Verified by a randomized convergence property test against a browser-history model.

## 1.10.1

### Patch Changes

- [`3580635`](https://github.com/kimjh96/flemo/commit/3580635dabf45d9ce23743ff17440750e4bc9ffe) Keep the screen and the URL in lockstep under rapid back/forward traversals across a nested Router boundary. A traversal task whose Router unmounted before it ran now aborts instead of deadlocking the shared navigation queue; a nested Router derives its history-state key from its enclosing screen's entry id so a remount can read the frames its previous incarnation wrote; a traversal that cannot be faithfully classified adopts the entry without a transition instead of ignoring it; and a remounted Router no longer renames a history entry the browser had already moved past.

## 1.10.0

### Minor Changes

- [`5b17d4b`](https://github.com/kimjh96/flemo/commit/5b17d4bae35a7d765ba141009a773c63c59d7586) Protect transitions from image re-decode and reveal-raster jank, whatever assets a consumer uses. A frozen screen's decoded images are discarded by the browser; the anim-hold release now waits (bounded) for the entering screen's images to re-decode, a covered screen entering on pop parks at its destination during the hold so its tiles pre-rasterize (gated on the covering screen's background being opaque, with the paused hold as fallback), and every unfreeze eagerly re-decodes the screen's images so a swipe reveal — which no hold can cover — starts warming immediately.

## 1.9.0

### Minor Changes

- [`40d8584`](https://github.com/kimjh96/flemo/commit/40d8584c75291b96b10a3cda59c93d40acc3209c) Finish the framework-neutralization pass: `resolveTransition` (name → registered transition with the `none` fallback) and `subscribeStepParamsRestore` (step-frame param restore on back/forward) move into `@flemo/core`, and the React binding delegates to them. No behavior change.

## 1.8.0

### Minor Changes

- [`4e54577`](https://github.com/kimjh96/flemo/commit/4e545777a41fa1dac7b23aba193cc85f3cf73c7f) Move every framework-neutral piece of the React binding into `@flemo/core` so future bindings (Svelte, Solid) reuse it: `createStepController` (step push/replace/pop orchestration), `createRouterScope` (store-bundle creation/seeding, with the `FlemoStores` type), `buildRoutePath`, `matchesPathname`, `enteringInitialStyle`, `registerTransitionDefinitions`, `observeBarHeight`, and `observeViewportScrollHeight`. `@flemo/react` now delegates to them with no behavior change.

## 1.7.0

### Minor Changes

- [`deed72d`](https://github.com/kimjh96/flemo/commit/deed72d2765caefa970a99315b195a0751c83e19) Fix a shared bar riding a frame behind its screen on browser-back navigation. `data-flemo-bar-riding` is now computed in render and committed alongside the bar's status, so the bar starts its keyframe in the same frame as the screen for any transition and any trigger (a programmatic `pop` or the browser back button). The internal `driveBarRiding` engine helper is replaced by the pure `computeBarRiding`.

### Patch Changes

- [`deed72d`](https://github.com/kimjh96/flemo/commit/deed72d2765caefa970a99315b195a0751c83e19) Anchor a transition's start to the screen's first painted frame. iOS WebKit starts the animation clock when the style commits, so a heavy entering screen (large list, fetch-on-mount) burned the opening of the transition rasterizing its first frame and the animation visibly skipped ahead; the animation is now held paused for the first two frames and then plays its full duration against already-painted layers.

## 1.6.1

### Patch Changes

- [`7513f82`](https://github.com/kimjh96/flemo/commit/7513f82eac7788d7c49ba57efd248a60b4d906f2) Fix the swipe-back gesture not starting. The controller located the previous screen through a freeze wrapper element that the React `<Activity>`-based screen freeze no longer renders, so the drag found no screen to reveal and bailed. It now walks direct sibling containers to find the previous screen.

## 1.6.0

### Minor Changes

- [`9937291`](https://github.com/kimjh96/flemo/commit/993729187939f96122381cd740343a7a8878efc1) Expose pluggable history drivers. `createNavigationController` / `createHistorySync` can now run against an injected `HistoryDriver` instead of the browser History API: `createBrowserHistoryDriver` (the default) or `createMemoryHistoryDriver` for a local, in-memory stack.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Let a Router run on a custom history backend. Router accepts a `createDriver` factory, and HistoryDriver gains `readPathname()`, so the Router reads and writes the URL only through its driver. A wrapper (e.g. a locale-aware driver that keeps a `/ko` prefix in the address bar while the Router matches unprefixed paths) can now own the whole URL surface without the Router touching window.location directly.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Add a per-Router `history` prop (`"browser"` default, `"memory"` opt-in) that decouples the history backend from nesting. A nested `<Router>` now participates in browser back/forward by default, while `history="memory"` keeps its previous isolated in-memory stack. Browser Routers namespace their `window.history.state` by a stable key and use a per-Router self-pop guard so multiple browser Routers coexist without clobbering each other.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Rename the `Screen` bar props to position-based, platform-neutral names: `appBar` to `topBar`, `navigationBar` to `bottomBar`, `sharedAppBar` to `sharedTopBar`, `sharedNavigationBar` to `sharedBottomBar` (the exported `SharedBarPresence` fields rename to match). Behavior is unchanged. This is a breaking rename: update any `Screen` that sets these props. The old `navigationBar` was easy to misread since it means the top bar on iOS and the web, while flemo uses it for the bottom one.

### Patch Changes

- [`35f29e9`](https://github.com/kimjh96/flemo/commit/35f29e99902362c2ade3c9652af7442829ea0a13) A `<Router>` nested inside another is now a local transition region: it runs its own in-memory history (no browser back/forward, no URL change) and contains its screens to its box via `position: absolute`, so only that region transitions while the surrounding layout (sidebars, headers) persists. A root `<Router>` is unchanged.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Make usePathname report a pop's destination immediately, consistent with push. The history store tracks a `pendingIndex` that advances to the target as soon as a pop starts (the render index still lags on the leaving screen until the transition resolves), and usePathname reads it. A browser Back no longer leaves chrome (active nav highlight, breadcrumbs) on the old route until the back animation finishes.

- [`32a5c6e`](https://github.com/kimjh96/flemo/commit/32a5c6e2d94c16bda0af5d9b90989abf8c213912) Fix useStep losing the screen's params in a keyed browser Router (a nested Router, or more than one Router on the page). pushStep/popStep and the step param restoration now go through the Router's own driver and self-pop guard, so closing a step (close button or browser Back) returns to the screen it was opened from instead of resetting to the first one. A deep-linked screen now seeds its params into the history frame too.

## 1.5.0

### Minor Changes

- [`002c317`](https://github.com/kimjh96/flemo/commit/002c317647017b0c11dd4a3243fab830e2a535b1) Add progress-driven part transitions. `createPartTransition` defines a named, status×active animation for a single element (any CSS property), and `<Part name="...">` runs it on that element anywhere inside a screen: an app/navigation bar child, body content, anything. Programmatic transitions play on the compositor with no React re-render, and the same definition follows the swipe-back drag inline. Register the transitions through the `Router`'s `partTransitions` prop. `createRawPartTransition` gives full per-variant control.

## 1.4.0

### Minor Changes

- [`475540c`](https://github.com/kimjh96/flemo/commit/475540cfbbf78614b4227fc798c0f4d3987852d6) Make the navigation stores request-scoped so screens render during SSR. The
  history/navigate/transition/screen stores are no longer module-level singletons
  shared across every SSR request; the Router now creates one bundle per mount,
  seeds it from `initPath`, and provides it via context. Because the seed is the
  store's initial state, zustand hands it to React as the server snapshot, so the
  screen stack paints on the server (previously the root was empty until the
  client mounted) and each concurrent request keeps its own stack.

  The public API (`Router`, `Route`, `useNavigate`, `useParams`, `useScreen`,
  `Screen`, `LayoutScreen`) is unchanged. Internally, `@flemo/core` now exposes the
  stores as `createHistoryStore` / `createNavigateStore` / `createTransitionStore`
  factories instead of singleton hooks.

### Patch Changes

- [`cf01904`](https://github.com/kimjh96/flemo/commit/cf01904fb806408db03cba65ceb4026201d3b551) Roll up Renovate dependency updates. Bump runtime and peer ranges: `react`/`react-dom` to `^19.2.7`, `motion` to `^12.40.0`, `path-to-regexp` to `^8.4.2`, `zustand` to `^5.0.14`. Also refreshes web app and toolchain deps (next, fumadocs, tailwindcss, eslint, typescript, vite) with no API changes.

## 1.3.0

### Minor Changes

- [`0e7e44b`](https://github.com/kimjh96/flemo/commit/0e7e44b227c8b9eec20309aa416b33beba712d7f) `useNavigate().pop` now accepts a `transitionName` to override the back animation — handy when collapsing several screens with `skip` / `until`, where the leaving top's own transition isn't the one you want. The override is applied in the same commit that starts the pop, so the original transition never paints a frame.

## 1.2.0

### Minor Changes

- [`156a6f3`](https://github.com/kimjh96/flemo/commit/156a6f3f71c8b81128a9fc6efce8075bc9579bef) `useNavigate().pop`, `replace`, and `push` now take an optional distance — `{ skip }` (a number of screens) or `{ until }` (a route pattern) — to reach a screen below the top in a single transition. The skipped screens are removed without ever painting, so they never flash by.

  All three reach the same target (`{ skip: n }` is the screen `n` below the top; `{ until }` is the nearest match) and differ only there: `pop` lands on it, `replace` replaces it (the target and everything above become the new screen), and `push` keeps it and stacks the new screen on top.

  `{ skip }` clamps to the stack depth; an unmatched `until` is a no-op for `pop`/`replace` and a plain push for `push`. Plain `pop()` / `replace(path)` / `push(path)` are unchanged.

### Patch Changes

- [`4caa94d`](https://github.com/kimjh96/flemo/commit/4caa94d698eff23ef72bd72ce353f585a4942056) Make the cupertino transition's outgoing-screen parallax viewport-proportional. The previous screen now slides to `-30%` of the viewport width (matching iOS), instead of a fixed `-100px` that looked negligible on wide viewports and appeared to lag behind the incoming screen.

- [`4caa94d`](https://github.com/kimjh96/flemo/commit/4caa94d698eff23ef72bd72ce353f585a4942056) Fade the material transition's outgoing screen as it slides up, so the previous screen dissolves instead of just nudging behind the incoming one. Swipe-back mirrors the same fade.

- [`6df7e4f`](https://github.com/kimjh96/flemo/commit/6df7e4fd5c3446771fbc9602d703273e75615af6) Drop the explicit cupertino easing from the overlay decorator's push/pop dim so it animates on the default ease curve.

## 1.1.2

### Patch Changes

- [`dd05e27`](https://github.com/kimjh96/flemo/commit/dd05e276b7ae2358eb03ac4f2b322725cfb81a79) Align the `overlay` decorator's `enter` / `exit` duration and easing to cupertino's push / pop slides (0.7s / 0.6s, cubic-bezier(0.32, 0.72, 0, 1)). The keyframe now reaches its `to` value exactly when the screen status flips to COMPLETED, eliminating the `fill: both` hold sub-window where the rest-rule handoff could race against the compositor. Swipe handler durations stay at 0.3s so the gesture release remains responsive.

- [`dd05e27`](https://github.com/kimjh96/flemo/commit/dd05e276b7ae2358eb03ac4f2b322725cfb81a79) Hold `overlay`'s `backgroundColor` static at the target dim across every variant so only `opacity` is keyframe-animated. Effective dim is now `opacity × 0.3` (linear) instead of the previous `opacity × bg_alpha` product (which produced ≈0.075 at midpoint — barely visible — and jumped to 0.3 only at the very end). The keyframe is also single-property, which avoids iOS Safari's known color-space interpolation quirks for `background-color` under a transformed ancestor and shrinks the `will-change` hint to `opacity` alone.

## 1.1.1

### Patch Changes

- [`ac42b4b`](https://github.com/kimjh96/flemo/commit/ac42b4bb7fc7f26d471804a34bafbe80a34d0c93) Compile `contain: layout` and `pointer-events: none` into transitioning variant rules alongside `will-change`. Scoped to `PUSHING` and `REPLACING` only — the verbs that actually trigger a fresh screen mount. Pop is excluded: ScreenFreeze keeps the destination screen mounted so there's no mount work to isolate, and harness measurements showed a small but consistent regression on heavy-DOM exiting screens during pop attributable to containment-block evaluation cost. The hints activate only during the transition window and are released the instant the status flips back to `IDLE`/`COMPLETED`.

## 1.1.0

### Minor Changes

- [`a103461`](https://github.com/kimjh96/flemo/commit/a1034612ca3b2c2d564d9e1d8c7991e36a985ac2) Fix `createDecorator` so the decorator transition runs on the right screen. Previously every `*-true` variant (active side) and every `*-false` variant (inactive side) was forced through the two-state `enter` / `exit` pair: `IDLE-true`, `PUSHING-true`, `POPPING-true`, and `COMPLETED-true` all mapped to `enter`, while `PUSHING-false`, `REPLACING-false`, and `COMPLETED-false` all mapped to `exit`. That collapse meant the active side had to use one value for both "active at rest" and "the entering animation's target," which only worked if the two were identical — for the built-in `overlay` they were (`opacity: 0` for both), and the result was that no decorator animation was visible at all on the new screen entering or the previous screen going behind.

  `createDecorator` now takes a required `idle` separate from `enter` / `exit`, with three distinct roles:
  - `idle` — resting position. Held at IDLE-*, COMPLETED-true, POPPING-true, and the *new\* screen during PUSH / REPLACE (`PUSHING-true` / `REPLACING-true`). The entering screen lands here so its decorator stays invisible on top of the new active screen.
  - `enter` — target for the screen moving INTO the background. Used on `PUSHING-false` / `REPLACING-false` (peak) and `COMPLETED-false` (settled). For overlays this is the dim state — the previous screen darkens.
  - `exit` — target for the previously-behind screen returning to active on `POPPING-false`. Animates from `enter` (its prior settled position) toward `exit`. Match `exit` to `idle` to land softly on the active rest rule.

  The built-in `overlay` decorator picks the new mapping up natively, so cupertino's push now darkens the screen sliding behind (was statically mounted before) and pop now smoothly clears the dim as the previous screen returns. Authors who used `createDecorator` directly must add an `idle` argument; per-state control via `createRawDecorator` is unchanged.

## 1.0.2

### Patch Changes

- [`5b5eb2f`](https://github.com/kimjh96/flemo/commit/5b5eb2ffb7a940e7b0f4bc38babbbd72234ba937) Migrate the canonical site URL from `flemo-web.vercel.app` to `flemo.dev`. Updates `homepage` in the three published packages' `package.json` (so npm shows the new domain), the docs landing's `metadataBase` (so OG / canonical tags resolve under `flemo.dev`), and the `@flemo/react` README links. The old Vercel preview URL stays accessible but `flemo.dev` is the home from this release onward.

## 1.0.1

### Patch Changes

- [`a6a3550`](https://github.com/kimjh96/flemo/commit/a6a35501ba640ed1cfa72e202fc4ef53cf487704) Stop appending `px` to CSS custom property values during transition compilation. `{ "--space": 16 }` now compiles to `--space: 16;` instead of `--space: 16px;`. Custom properties are typeless — flemo can't know whether the author intends pixels, a count, a ratio, or a multiplier — so the safe default is to pass the raw scalar through and let the call site shape the unit (e.g., `calc(var(--space) * 1px)` in CSS). Mirrors React's `name.startsWith("--")` short-circuit in inline-style coercion.

- [`9e0384c`](https://github.com/kimjh96/flemo/commit/9e0384c6cbe34cfec71d541fa0f52319b647f2eb) Compositor-synced shared-bar ride-along. The previous rAF mirror loop read `getComputedStyle(scope)` and wrote inline styles onto the bars every frame — a main-thread roundtrip that left bars trailing the screen by one composited frame, especially visible on mobile. The compiled transition rule now emits a sibling selector targeting `[data-flemo-bar][data-flemo-bar-riding="true"]` with the same `@keyframes` the screen uses, so the bar runs the same animation on the same compositor pass — zero JS in the loop, pixel-exact sync. The rAF path is retained narrowly for swipe-drag, where the screen itself is already main-thread inline-driven and there is no compositor advantage to chase.

- [`f3e8ac9`](https://github.com/kimjh96/flemo/commit/f3e8ac9dd909fabc11621f6bd29449c286fb3bda) `TransitionTarget` now extends `csstype.Properties`, so every transition-able CSS property — `filter`, `backdropFilter`, `color`, `boxShadow`, `borderRadius`, `clipPath`, `letterSpacing`, and the rest of the CSS surface — gets full IDE autocomplete and value-type narrowing inside `createTransition({ initial, idle, enter, ... })`. The previous interface only typed transform shortcuts, `opacity`, and `backgroundColor`; every other property still worked at runtime thanks to the broad index signature, but offered zero editor support. flemo-specific transform aliases (`x`, `y`, `z`, `scale*`, `rotate*`) keep their existing semantics — csstype's own `rotate` / `scale` / `translate` standalone properties are omitted so the shortcut wins. CSS custom properties (`--foo`) remain animatable via a `--`-prefixed index signature.

- [`04a03d9`](https://github.com/kimjh96/flemo/commit/04a03d985d5517d87d570ea8b696dbaee3ef334e) Stop appending `px` to unitless CSS property values during transition compilation. Numbers passed to `lineHeight`, `fontWeight`, `zIndex`, `flexGrow`, `flexShrink`, `aspectRatio`, `columnCount`, `order`, `tabSize`, SVG opacity / stroke numerics, and similar unitless properties now compile straight through (`{ lineHeight: 1.5 }` → `line-height: 1.5;`). Previously the compiler defaulted any non-transform number to `…px`, which emitted invalid declarations like `line-height: 1.5px`. String values were already passed through verbatim, so the existing `"1.5"` workaround stays compatible. Mirrors the well-known unitless-property allowlist React uses for inline styles.

## 1.0.0

### Major Changes

- [`266008e`](https://github.com/kimjh96/flemo/commit/266008e65efa3f3c1357389a67c193cdff0df616) - Stabilize the public API at 1.0.0. The screen / transition / navigate / store surfaces (Router, Route, Screen, useNavigate, useStep, useScreen, useParams, createTransition, createDecorator, TaskManger, history & navigate stores) are now SemVer-major versioned — future breaking changes go through an explicit major bump and a migration note in this changelog. `@flemo/react-layout` stays in `0.x` until its motion-free FLIP migration lands.

### Minor Changes

- [`7940122`](https://github.com/kimjh96/flemo/commit/79401229827beb0ce974ba2dee049b309081ca44) - Initial release of `@flemo/core` — flemo's framework-agnostic primitives. Contains the navigation queue (`TaskManger`), history + navigate zustand stores, the self-pop guard, the transition + decorator factories with built-in presets (`cupertino`, `material`, `layout`, `none`, `overlay`), the CSS keyframes compiler, and pure utilities (`isServer`, `getParams`, `getMatchedPathPattern`, `findScrollable`). No React or Motion runtime dependency — animation target types are defined locally. `@flemo/react` depends on it; consumers who only need transition primitives can install `@flemo/core` directly.

- [`7b3a038`](https://github.com/kimjh96/flemo/commit/7b3a038214a314fa3b7facfefe4cb8d30a851335) - Restore coexistence with consumer overlays (bottom sheets, dialogs) that rely on `position: fixed` and z-index. The screen scope no longer establishes a containing block or stacking context at rest: identity transform targets compile to `transform: none`, and the screen wrapper uses `contain: layout style` instead of `contain: strict`. The shared app/navigation bar ride-along is now generic over every property a transition writes — `collectAnimatedProperties` is mirrored from scope to bar each frame — so authoring a custom transition with `opacity`, `filter`, or any other CSS property no longer leaves the bar out of sync.

### Patch Changes

- [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58) - `findScrollable` correctness + side-effect fixes that show up on every swipe-back pointerdown:
  - `canProgrammaticallyScroll` no longer mutates the candidate's `scrollTop` / `scrollLeft` to probe scrollability. It now reads `overflowX` / `overflowY` from computed style instead — same intent (does this element actually scroll on this axis?) without firing scroll events or interfering with `scroll-snap` / `scroll-behavior: smooth` consumers.
  - The ancestor walk no longer stops at `document.body`, so viewport-level scrolling on `<html>` (`documentElement`) — the default for many apps — is now detected as a scroll boundary and gates swipe-back correctly.
  - `getStartElement` now returns `null` instead of force-casting non-Element event targets (`document`, `window`, `Text`) to `HTMLElement`, avoiding a downstream crash in the parent-walk loop.

- [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58) - Fix `TaskManager.resolveTask` rejecting `SIGNAL_PENDING` tasks. `emitSignal` delegates to `resolveTask`, so the previous status guard turned signal mode (`control.signal`) into a permanent no-op — any task parked on a signal would have hung indefinitely. Both `MANUAL_PENDING` and `SIGNAL_PENDING` now flow through the same resolution path.

- [`3c79a56`](https://github.com/kimjh96/flemo/commit/3c79a56b2b87563162be0fa56782a5216ca55d58) - Emit `will-change` on each compiled transition's variant rule, derived from the exact set of properties the transition writes — whatever the author put in `initial` / variant `value`s. The hint applies while the variant's status selector matches (PUSHING/POPPING/REPLACING) and releases the moment status flips back to IDLE/COMPLETED, so the compositor layer is allocated only for the animation window. Shared bars riding along via JS mirroring receive the same per-transition property set. Sustained 60fps for any author-defined transition target, not just transform/opacity.
