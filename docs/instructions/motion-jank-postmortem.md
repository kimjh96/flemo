# Postmortem: the 2026-07/08 motion-jank campaigns

The regression-prevention document. Months of device rounds (desktop Chrome/Safari,
iPhone Safari incl. Low Power Mode, Galaxy Note 9, Pixel 9) produced today's engine
(PR #240, #251, #252, #256, #258) — and an equally valuable _falsification map_. If you
are investigating a motion-jank report, read (a) and (e) first; before designing any
fix, check the DO-NOT-RETRY list. History is recorded as history — for what the code
does TODAY, the code and `docs/architecture/*` win.

## Contents

- [(c) DO-NOT-RETRY list](2026-08-motion-jank/do-not-retry.md)
- [(d) Worked example: the desktop player blank (#256 → #259)](2026-08-motion-jank/desktop-player-blank.md)
- [Addendum — 2026-08-17 evening: the attribution re-verified live](2026-08-motion-jank/addendum-2026-08-17.md)
- [Addendum 2 / 2026-08-18 live glass campaign, instrument traps, final attribution](2026-08-motion-jank/glass-campaign-2026-08-18.md)
- [2026-08-30: the long-content reveal block on iOS Safari](motion-jank-postmortem/long-content-reveal-block-2026-08-30.md)

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
   Do not re-investigate from web code; the do-not-retry list records every angle
   already falsified.
2. **Sub-pixel bilinear resampling (flemo-reachable).** Blink composites transformed
   layers at fractional device-pixel offsets with bilinear filtering; the decelerating
   tail lingers multiple frames per phase → texture/glyph sharpness pulses. Proven with
   static fractional-offset energy tests (energy 0.251 at phase 0 vs 0.030 at 0.5) and
   shift-compensated captures (integer-stepped layers diff to exactly zero). Addressed
   by: translate3d-only compilation, the player's snap gate + landing governor, and the
   compiled tier's governed landing easing. The _full-flight_ snap was device-judged
   worse than fractional glide (twice, by the same physics as the author's historical
   2D-vs-3D transformPart verdict) → opt-in `flemo:landing-snap`. A separate
   contributor at the app layer: Skia renders CSS gradients WITH dither grain — a
   sliding screen-sized gradient decorrelates the grain field every 1-px step
   (duration-invariant, area-proportional); fixed by baking gradients to bitmaps in the
   consumer app (grain is texture-anchored in a bitmap).
3. **Mount-commit opening stalls (settle gate / holds).** A heavy entering screen's
   render+commit is a multi-hundred-ms main task NO driver can hide; the only choice is
   whether it runs BEFORE the flight (settle gate: full-duration flight carrying real
   content, at the cost of start latency) or INSIDE it (swallowed opening). The gate was
   device-rejected as a _data_ wait ("게이트 접근 최종 기각") but shipped as a
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
   capture, browser-independent. (Environment attribution itself flip-flopped until the
   _docked, external-display_ setup was established — another checklist-#1 case.)

Other standalone real bugs found en route: cold-profile GPU pipeline compile stalls
(→ gpuPipelinePrewarm), COMPLETED-flip layer demotion repaint (→ layerSettleHold),
the swipe-settle takeover race (edge-zone taps with 1-5px wobble registering as grabs;
→ 6px tap slop + `settleScrubber.takeover`), the stale-resolver double resolution
(→ captured task ids), the page-wide swipe recognizer claiming Android vertical-fling
jitter and committing a cancelled pointer (→ 8px intent slop + 3:1 axis lock + neutral
cancel), transition-time `pointer-events: none` stranding a touch on the covered screen
(→ hit-testable destination + click-only capture gate), and the compositor wake-up loss
(→ warm-up + interaction warm).

## (e) Debugging checklist for the NEXT motion-jank report

1. **Establish the viewing configuration FIRST.** Screenshot of the actual setup:
   plain window vs DevTools device emulation, which physical display (internal /
   external, refresh rate, HiDPI scaling mode), docked or not, Low Power Mode. The
   single highest-leverage question of the whole campaign (~10 rounds saved had it been
   asked first).
2. **Check active overrides.** `flemo:*` session/local storage on the affected device;
   any `?flemo-…`/app-level toggle params in the URL; pin warnings in the console.
   Mobile tab restoration resurrects sessionStorage across days.
3. **Read badges/toggles in any user video FIRST** — before analyzing motion. Two root
   causes (emulation toolbar, `?snap=off`) were literally visible in frame.
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
