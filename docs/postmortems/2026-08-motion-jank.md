# Postmortem: the 2026-07/08 motion-jank campaigns

The regression-prevention document. Months of device rounds (desktop Chrome/Safari,
iPhone Safari incl. Low Power Mode, Galaxy Note 9, Pixel 9) produced today's engine
(PR #240, #251, #252, #256, #258) — and an equally valuable _falsification map_. If you
are investigating a motion-jank report, read (a) and (e) first; before designing any
fix, check (c). History below is recorded as history — for what the code does TODAY,
the code and `docs/architecture/*` win.

## (a) Symptom taxonomy

User reports arrive in these Korean words; distinguishing them is half the diagnosis.

| Term                        | English                               | What it actually is                                                                                                                                                                                                                                                                                                                                  | First checks                                                                        |
| --------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 수렴 떨림 / 지글거림 / 시머 | convergence tremor / sizzle / shimmer | A **spatial** artifact of the slow tail: sub-pixel bilinear resampling (fractional layer offsets washing texture/glyph AA per frame), dither grain sliding, or display-pipeline effects. Frame timing is typically PERFECT while it happens — invisible to rAF/trace metrics; only pixel probes (screenshot energy) or the eye see it.               | Viewing config (emulation? HiDPI scaling?), dpr, snap policy, pure-CSS control page |
| 버벅(임)                    | stutter / jank (frame time)           | A **temporal** artifact: missed/uneven presented frames. Sources split by layer: main-thread famine (player), compositor raster stalls, GPU pipeline compiles, or the browser's own present pacing.                                                                                                                                                  | `__flemoPlayerGaps`, trace with non-forcing categories, which driver routed         |
| 씹힘                        | swallowed opening                     | The flight's first 0–70% never presented: the animation clock aged past the opening while nothing new reached the glass (mount/release commit block on a wall-clocked animation), or the content painted late into an already-moving container (Note 9 mode).                                                                                        | Which tier drove; hold/park state; was the settle gate engaged                      |
| 휙휙                        | whoosh / rushed opening               | Related but distinct from 씹힘 (user-defined 2026-08-12): the 0→60% IS shown but as sparse, rushed frames — wall-clock playback through early load drops = coarse sampling of the fast segment. The player's capped clock is structurally immune (load-adaptive time dilation); a wall-clocked compiled animation cannot have that property by spec. | Driver; a pure-CSS mount+start-in-one-commit repro shows it with zero flemo code    |
| 드르륵 / 계단               | stepping / quantization               | Integer-snap stepping on slow tracked motion (≤1 device px/frame presented as stall-then-step). The physical trade opposite shimmer: at the slow tail you get EITHER fractional-blur sizzle OR integer stepping — both were device-judged; the velocity gate default is the reachable floor.                                                         | `flemo:snap` override state, dpr                                                    |
| 멈췄다 휙                   | freeze-then-leap                      | Mid-flight freeze with a catch-up jump at resume — a wall-clocked animation surviving a main-thread block, or (historically) a mid-flight-born animation desyncing WebKit's accelerated re-sync.                                                                                                                                                     | Chain state, driver, suspense commits mid-flight                                    |

## (b) The layered final attributions

The campaign's central lesson: "the jank" was never one thing. Six-plus independent
layers, each proven separately:

1. **Chrome macOS present pipeline (NOT flemo — proven unreachable).** The residual
   convergence trembling on the user's machines (M-series Mac, 120Hz ProMotion AND
   60Hz 4K HiDPI externals) reproduced on a **no-`<script>` pure-CSS control page**
   containing only flemo's own compiled cupertino keyframes — zero web code running,
   still trembles. Passive HUD showed exactly-120Hz rAF with low jitter _while the eye
   saw trembling_ → the fault is below rAF, in scanout/present pacing. Chrome itself
   tracks the defect (CVDisplayLink→CADisplayLink migration: Chromium issues
   **40062488**, **345275139**; flag `kCADisplayLink`, macOS 14+, default-off as of the
   campaign). The "sticky smooth" state = the GPU process flipping to continuous even
   present, triggered only by _browser-process_ per-vsync drawing (DevTools FPS meter,
   `--show-fps-counter`) — pages cannot trigger it by submitting frames.
   **Machine workaround** (dev/demo/recording only):
   `killall "Google Chrome"; open -na "Google Chrome" --args --show-fps-counter`.
   Do not re-investigate from web code; the do-not-retry list below records every
   angle already falsified.
2. **Sub-pixel bilinear resampling (flemo-reachable).** Blink composites transformed
   layers at fractional device-pixel offsets with bilinear filtering; the decelerating
   tail lingers multiple frames per phase → texture/glyph sharpness pulses. Proven
   with static fractional-offset energy tests (energy 0.251 at phase 0 vs 0.030 at
   0.5) and shift-compensated captures (integer-stepped layers diff to exactly zero).
   Addressed by: translate3d-only compilation, the player's snap gate + landing
   governor, and the compiled tier's governed landing easing. The _full-flight_ snap
   was device-judged worse than fractional glide (twice, by the same physics as the
   author's historical 2D-vs-3D transformPart verdict) → opt-in `flemo:landing-snap`.
   A separate contributor at the app layer: Skia renders CSS gradients WITH dither
   grain — a sliding screen-sized gradient decorrelates the grain field every 1-px
   step (duration-invariant, area-proportional); fixed by baking gradients to bitmaps
   in the consumer app (grain is texture-anchored in a bitmap).
3. **Mount-commit opening stalls (settle gate / holds).** A heavy entering screen's
   render+commit is a multi-hundred-ms main task NO driver can hide; the only choice
   is whether it runs BEFORE the flight (settle gate: full-duration flight carrying
   real content, at the cost of start latency) or INSIDE it (swallowed opening). The
   gate was device-rejected as a _data_ wait ("게이트 접근 최종 기각") but shipped as a
   _render-settle-only_ wait (`renderSettleOnly: true` — waits for commit quiescence,
   never for data), default-on for touch WebKit and validated even on a demoted Note 9
   (its 290ms mount task stalls even the compositor's initial layerization).
4. **Image decode (offloader + auto-gate).** 37-megapixel originals painted into 44px
   slots: WebKit decodes synchronously on-main at full resolution (offloader:
   fetch+decode+downscale off-main for CORS-readable oversized sources); Note 9's
   swallow was late content paint from off-main decode+raster landing mid-slide —
   timing/hide/scrub fixes all device-falsified there, only pixel reduction worked →
   offloader auto-gated on `isLegacyAndroidBlink()` (PR #252). `decoding="async"`
   stamping (imageDecodeHygiene) covers the rest.
5. **The device-emulation observation trap.** Weeks of "residual 버벅/지글임" were the
   DevTools device toolbar's scaled rendering path — discovered only when the user's
   phone video showed "Responsive 603×735" in frame; emulation off + narrow window =
   "부드럽네요". Now guarded by `emulationNotice.ts` and rule #1 of the debugging
   checklist.
6. **Display hardware.** One residue tracked to the MacBook Pro 14 XDR mini-LED local
   dimming following a bright sliding panel — backlight-level, invisible to every
   capture, browser-independent. (Environment attribution itself flip-flopped until
   the _docked, external-display_ setup was established — another checklist-#1 case.)

Other standalone real bugs found en route: cold-profile GPU pipeline compile stalls
(→ gpuPipelinePrewarm), COMPLETED-flip layer demotion repaint (→ layerSettleHold),
the swipe-settle takeover race (edge-zone taps with 1-5px wobble registering as grabs;
→ 6px tap slop + `settleScrubber.takeover`), the stale-resolver double resolution
(→ captured task ids), and the compositor wake-up loss (→ warm-up + interaction warm).

## (c) DO-NOT-RETRY list

Each entry was implemented, deployed, and **falsified on real devices** (not in
theory). Do not re-attempt without genuinely new information; if you must, read the
full ledger in the session memories / git history first.

**Clock & animation surgery (WebKit)**

- **Any timing write to a running/pending WebKit accelerated animation** — rewinds,
  `startTime` pins, two-phase holds, pending-clock pins: either loses the race,
  desyncs the out-of-process re-sync, or WebKit cuts the flight to its end (~100ms in,
  trajectory-measured). The narrow exceptions that survive: the one-shot _birth-window_
  rewind (desktop WebKit) and pause/play first-frame hold for authored
  `driver:"native"` pins only.
- **Post-birth `animation-delay` extension** — the UI process counts the delay down
  autonomously and has already presented motion frames; the extension commit snaps
  them back to the from-pose and restarts (tab flash / push stutter). "The hold must
  be fully decided before the animation is born."
- **The three handoff designs** (giving a player-opened flight an accelerated tail):
  1. `scrub.play()` — a paused+scrubbed WAAPI animation loses its accelerated
     representation when played; the remainder rode the wall clock through blocks
     (freeze then leap — worse than the capped player).
  2. Compiled-CSS rebirth with a negative inline `animation-delay` — smooth per
     flight, but intermittently froze-then-rushed when a mid-flight suspense commit
     forced WebKit's accelerated re-sync; the unusual begin time desyncs exactly what
     a naturally-born animation survives. Also revived the engine's `animationend`
     resolver → the double-resolution bug (a duplicate resolution's deferred chain
     cuts the NEXT queued task — fast-back pop completed at ~90ms with no motion).
  3. Fresh remainder animation with `linear()` easing (and the baked-keyframe
     variant) — `linear()` has no Core Animation form → main thread → convergence
     stutter back; the baked accelerated variant hit re-sync desync (2). Net: the
     handoff survives only as a POP-scoped opt-in diagnostic.
- **CSS `calc(var())` in animation timing** — demotes WebKit fades off the compositor
  (2-frame collapse under starvation; bisected in a local rig). Timing must be
  literal; the compiler enforces this.
- **Adaptive/learned hold sizing from gap statistics** — the leisure ledger learns gap
  _length_, but the needed value is trouble-window _position_; every gap statistic
  under-covered (7/7 swallowed below the threshold). Static per-status heads won.
- **Calm-frame release gating by rAF gap evidence** — on high-refresh devices every
  ordinary mount aftermath reads as a storm; the gate rode its bound = pure added
  dead-wait.

**Routing**

- **Touch-Blink blanket compiled routing** — regressed fast Blink (Pixel 9 picked up
  compiled landing artifacts); routing must stay per-signal (high-refresh / demoted /
  legacy), not per-platform. (Note the _touch-WebKit_ side later DID go
  governed-compiled wholesale, with the flat-head kit — same destination, different
  engine, different reasons; don't cite one as precedent for the other.)
- **LPM-detection driver switching, all forms** — LPM caps the whole web process's
  rendering updates at ~30Hz (proven: timer-driven clocks are equally capped, and
  longTasks are EMPTY during the 100-340ms gaps — pure OS governor). Every supervisor
  runs on rAF, so compiled-under-LPM is definitionally unsupervisable; duration
  stretch (静的 2x) was rejected on feel. What finally worked under LPM was NOT
  routing: literal timing + flat-head keyframes (active-from-birth, commit lands in
  the invisible head) — which then generalized to all touch WebKit.
- **`scrub`-on-Note9 / any timing/transform/hide fix for Mode-B swallow** — its
  swallow is late _content paint_, not clock advance; freezing transforms can't touch
  it. Only pixel reduction (offloader downscale) works.
- **park-over (0.02-opacity on-top pre-raster)** — ghosting + stacking side effects;
  its motivating culling theory was a misdiagnosis (real culprit: var-timing). Kept
  only behind `flemo:preraster`.
- **Opacity masking, render-freeze (React visible+frozen), consumer-blur blame** —
  all falsified for the WebKit swallow.
- **content-visibility fold landing (Note 9)** — the deferred unhide's repaint is a
  second hitch on old CPUs.
- **Moving the rest landing commit around (Note 9 / LPM)** — all three placements
  device-judged (mid-flight = least bad, COMPLETED = end hitch, pre-release =
  deadlock era); the early-landing placement stays.

**Chrome-present-pipeline angles (all measured ineffective against layer-1)**

- Driver choice (compiled vs player), every easing shape (snap/governor/60Hz
  cadence-lock/bezier), every warm variant (per-flight, interaction, permanent 1px,
  fullscreen), keepalive rAF on/off, `canvas.captureStream` video, real
  hardware-decoded h264 video, the CADisplayLink flag, page-side present-timing
  compensation (future present times unknowable). **VRR-area hypothesis dead**: VRR
  max-rate is requested by animation _existence_, area-independent — a permanent 1px
  warm already requested it and the tremble persisted.
- (One warm DID survive falsification and shipped: the _never-stopping_ keepalive rAF
  for compiled Blink flights — an on/off per-flight loop barely helped, the permanent
  one device-confirmed. It steadies pacing; it does not fix layer-1.)

**Player micro-policies**

- **Jitter-cap + commit-miss compensation from a synthetic A/B** — real pages carry
  per-frame render cost that reads as a blown commit window; the compensation held
  frames constantly (synthetic win did not transfer). Noted in `stepPlayer`; do not
  re-attempt without an adaptive per-page baseline.
- **MIN-estimator display interval** — one runt gap throttled the whole flight; the
  median with a sustained-slow requirement is deliberate.
- **Per-flight warm variants** as a present-pacing fix — see above; only the
  session-permanent form helps.

## (d) Worked example: the desktop player blank (#256 → #259) — instrument before you revert

Symptom: `?driver=raf`-pinned desktop Chromium, push→pop→push re-entry → detail screen
completely blank. First response (PR #256) _reverted the pin pierce_ — correct triage
(production default was never affected) but it treated the player as the defect.
PR #259 (merged 2026-08-17) then instrumented instead of assuming: a frame-by-frame
trace showed the flight drove perfectly (1280→0, landing inline `none`) and the screen
blanked ONE COMMIT LATER. Root cause was a three-part cleanup interaction, not a
player bug:

1. the player track's detach restored its `transform` lease "original" — which for the
   actively-entered scope is the **flemo-rendered entering-initial from-pose**
   (`translate3d(100%,0,0)`), not a consumer value;
2. the COMPLETED force clear iterates only keys still in the lease map (the restore
   had just dropped the transform entry);
3. the empty-map fallback that strips transform/opacity never runs while any other
   lease survives the flip — and on desktop Blink the governed-easing
   `animation-timing-function` lease always does.
   Touch sessions were saved by accident (empty map → fallback). The shipped fix strips
   the scope's pose channels explicitly at COMPLETED, and the pin pierce was restored on
   the strength of it (with a desktop-chromium e2e guard).
   Lessons: (1) a clean flight + broken rest state means look at the CLEANUP
   path, not the driver; (2) "works on touch" can be an accident of map contents, not a
   design; (3) revert-first is fine for triage but the root cause must be paid down
   before the capability returns.

## (e) Debugging checklist for the NEXT motion-jank report

1. **Establish the viewing configuration FIRST.** Screenshot of the actual setup:
   plain window vs DevTools device emulation, which physical display (internal /
   external, refresh rate, HiDPI scaling mode), docked or not, Low Power Mode.
   The single highest-leverage question of the whole campaign (~10 rounds saved had it
   been asked first).
2. **Check active overrides.** `flemo:*` session/local storage on the affected device;
   any `?flemo-…`/app-level toggle params in the URL; pin warnings in the console.
   Mobile tab restoration resurrects sessionStorage across days.
3. **Read badges/toggles in any user video FIRST** — before analyzing motion. Two
   root causes (emulation toolbar, `?snap=off`) were literally visible in frame.
4. **Classify the symptom** with taxonomy (a): spatial (shimmer) vs temporal (frame
   time) vs opening (씹힘/휙휙) vs stepping. Ask the user which Korean word fits.
5. **Separate flemo from platform with the pure-CSS control.** Regenerate a
   no-`<script>` page from `compileTransitionStyles` output (the compiled keyframes,
   `will-change`, `contain`, an infinite slide loop). If it exhibits the symptom with
   zero web code, the cause is outside flemo — stop engineering and document.
6. **Know which layers are instrument-invisible.** rAF/longtask/trace metrics see the
   main thread only; present-pipeline judder, swallowed compositor frames, bilinear
   shimmer, backlight effects need pixel probes, camera video, or frame-extracted
   recordings. "All metrics clean + user still sees it" is a _layer_ signal, not a
   contradiction.
7. **Identify the routed tier before theorizing** — driver-routing.md decision tree;
   confirm on-device (suppressed `animation` + inline writes = player; `data-flemo-lpm`
   on root = governed compiled).
8. **When verifying through a consumer app via tarballs, fingerprint the served
   bundle** (diagnostics.md pitfall #7) before accepting any verdict — several rounds
   were judged against stale code.
9. **Check the falsification list (c)** before building. If a proposed fix is on it,
   the burden is a _new mechanism_, not a re-run.
10. **Respect the authoring-fidelity principle** (user-stated, standing): the library
    must not silently change the authored motion's meaning (no fade removal, no
    entry-suppression flips, no demands on consumer code like prefetch). Prescriptions
    must take the form "authored motion intact + internal scheduling/raster work";
    explicit user-selected trades are the only exception.
