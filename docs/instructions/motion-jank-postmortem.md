# Postmortem: the 2026-07/08 motion-jank campaigns

This regression-prevention record summarizes months of testing on desktop Chrome and Safari, iPhone Safari including Low Power Mode, Galaxy Note 9, and Pixel 9. It produced the current engine (PR #240, #251, #252, #256, #258) and a falsification map.

For a new motion-jank report, read the symptom taxonomy and debugging checklist first, then consult the DO-NOT-RETRY list before designing a fix. This document records history; current code and `docs/architecture/*` define present behavior.

## Contents

- [(c) DO-NOT-RETRY list](2026-08-motion-jank/do-not-retry.md)
- [(d) Worked example: the desktop player blank (#256 → #259)](2026-08-motion-jank/desktop-player-blank.md)
- [Addendum — 2026-08-17 evening: the attribution re-verified live](2026-08-motion-jank/addendum-2026-08-17.md)
- [Addendum 2 / 2026-08-18 live glass campaign, instrument traps, final attribution](2026-08-motion-jank/glass-campaign-2026-08-18.md)
- [2026-08-30: the long-content reveal block on iOS Safari](motion-jank-postmortem/long-content-reveal-block-2026-08-30.md)

## (a) Symptom taxonomy

Distinguishing the Korean terms used in reports is essential to diagnosis.

| Term | English | Meaning | First checks |
| --- | --- | --- | --- |
| 수렴 떨림 / 지글거림 / 시머 | convergence tremor / sizzle / shimmer | A spatial slow-tail artifact: sub-pixel bilinear resampling washes texture or glyph antialiasing at fractional layer offsets; dither grain slides; or the display pipeline contributes an effect. Frame timing is usually perfect, so rAF and trace metrics cannot see it; use pixel probes such as screenshot energy or visual inspection. | Viewing configuration, emulation, HiDPI scaling, dpr, snap policy, pure-CSS control page |
| 버벅(임) | stutter / jank (frame time) | A temporal artifact from missed or uneven presented frames. Possible layers include main-thread famine in the player, compositor raster stalls, GPU pipeline compilation, and browser present pacing. | `__flemoPlayerGaps`, a trace with non-forcing categories, routed driver |
| 씹힘 | swallowed opening | The first 0–70% of the flight is not presented. Either a mount/release commit blocks a wall-clocked animation until its opening has aged away, or content paints late into an already-moving container, as in Note 9 mode. | Driving tier, hold/park state, settle-gate engagement |
| 휙휙 | whoosh / rushed opening | Distinct from 씹힘, as defined by the user on 2026-08-12: 0→60% appears as sparse, rushed frames because early load drops coarsely sample the fast segment of wall-clock playback. The player's capped clock is structurally immune through load-adaptive time dilation; a wall-clocked compiled animation cannot provide that property by specification. | Driver; a pure-CSS mount-and-start-in-one-commit reproduction exhibits it without flemo code |
| 드르륵 / 계단 | stepping / quantization | Integer snapping turns slow tracked motion of ≤1 device px per frame into stalls followed by steps. It is the physical opposite of shimmer: the slow tail must accept either fractional-blur sizzle or integer stepping. Both were judged on devices, and the velocity-gate default is the reachable floor. | `flemo:snap` override, dpr |
| 멈췄다 휙 | freeze-then-leap | A mid-flight freeze followed by a catch-up jump: either a wall-clocked animation survives a main-thread block or, historically, a mid-flight-born animation desynchronizes WebKit's accelerated resynchronization. | Chain state, driver, mid-flight suspense commits |

## (b) Layered final attributions

The campaign proved that “the jank” comprised independent layers.

1. **Chrome macOS present pipeline, unreachable by flemo.** Residual convergence trembling on the user's M-series Mac, both 120Hz ProMotion and 60Hz 4K HiDPI external displays, reproduced on a no-`<script>` pure-CSS page containing only flemo's compiled cupertino keyframes. A passive HUD reported exactly 120Hz rAF with low jitter while trembling remained visible, locating the fault below rAF in scanout or present pacing. Chromium tracks the CVDisplayLink→CADisplayLink migration in issues **40062488** and **345275139**. The `kCADisplayLink` flag requires macOS 14+ and was default-off during the campaign. The “sticky smooth” state occurred when the GPU process switched to continuous even presentation, triggered only by browser-process per-vsync drawing such as the DevTools FPS meter or `--show-fps-counter`; page frame submission cannot trigger it. For development, demos, or recording only, use `killall "Google Chrome"; open -na "Google Chrome" --args --show-fps-counter`. Do not investigate this again in web code; consult the falsification list.
2. **Sub-pixel bilinear resampling, reachable by flemo.** Blink composites transformed layers at fractional device-pixel offsets using bilinear filtering. The decelerating tail holds phases long enough for texture and glyph sharpness to pulse. Static fractional-offset tests measured energy 0.251 at phase 0 versus 0.030 at 0.5; shift-compensated captures of integer-stepped layers differed by exactly zero. Mitigations are translate3d-only compilation, the player's snap gate and landing governor, and governed landing easing in the compiled tier. Full-flight snapping was judged worse than fractional glide twice, following the same physics as the author's historical 2D-versus-3D `transformPart` verdict, so it remains opt-in as `flemo:landing-snap`. At the application layer, Skia dithers CSS gradients; moving a screen-sized gradient decorrelates its grain field at every 1px step, independent of duration and proportional to area. Consumer applications fixed this by baking gradients into bitmaps so grain stays texture-anchored.
3. **Mount-commit opening stalls: settle gate and holds.** Rendering and committing a heavy entering screen can occupy the main thread for hundreds of milliseconds; no driver can hide that work. It must occur before the flight, yielding start latency but a full-duration flight with real content, or during the flight, swallowing the opening. Device testing rejected waiting for data (“게이트 접근 최종 기각”) but accepted a render-settle-only wait: `renderSettleOnly: true` waits for commit quiescence and never for data. It is enabled by default for touch WebKit and was validated on a demoted Note 9, where a 290ms mount task even stalls initial compositor layerization.
4. **Image decode: offloader and auto-gate.** WebKit synchronously decodes 37-megapixel originals on the main thread even when displayed in 44px slots. The offloader fetches, decodes, and downsizes oversized CORS-readable sources off-main. On Note 9, off-main decode and raster landed mid-slide and caused late content paint; timing, hiding, and scrubbing fixes were all falsified on-device, and only pixel reduction worked. PR #252 therefore auto-gates the offloader with `isLegacyAndroidBlink()`. `decoding="async"` stamping through `imageDecodeHygiene` covers other images.
5. **Device-emulation observation trap.** Weeks of residual 버벅/지글임 came from the DevTools device toolbar's scaled-rendering path. The clue was “Responsive 603×735” visible in the user's phone video; disabling emulation and using a narrow window produced “부드럽네요”. `emulationNotice.ts` now guards this case, which is also checklist item 1.
6. **Display hardware.** One residue came from the MacBook Pro 14 XDR mini-LED local dimming following a bright moving panel. This backlight-level effect was invisible to captures and browser-independent. The environment attribution changed until the docked external-display setup was established, reinforcing checklist item 1.

Other independent bugs found during the campaign were:

- Cold-profile GPU pipeline compilation stalls, addressed by `gpuPipelinePrewarm`.
- COMPLETED-flip layer-demotion repaint, addressed by `layerSettleHold`.
- A swipe-settle takeover race where edge-zone taps with 1–5px wobble became grabs, addressed by 6px tap slop and `settleScrubber.takeover`.
- Stale-resolver double resolution, addressed by captured task IDs.
- A page-wide swipe recognizer claiming Android vertical-fling jitter and committing a cancelled pointer, addressed by 8px intent slop, a 3:1 axis lock, and neutral cancellation.
- Transition-time `pointer-events: none` stranding a touch on the covered screen, addressed by a hit-testable destination and click-only capture gate.
- Compositor wake-up loss, addressed by warm-up and interaction warm.

## (e) Debugging checklist for the next report

1. **Establish the viewing configuration first.** Obtain a screenshot of the actual setup. Record plain window versus DevTools device emulation, physical display, internal or external connection, refresh rate, HiDPI scaling mode, docked state, and Low Power Mode. This was the campaign's highest-leverage question and could have saved roughly ten rounds.
2. **Check active overrides.** Inspect `flemo:*` session and local storage on the affected device, `?flemo-…` and application toggle parameters in the URL, and pinned console warnings. Mobile tab restoration can preserve sessionStorage for days.
3. **Read badges and toggles in user videos before analyzing motion.** The emulation toolbar and `?snap=off`, two root causes, were visible in recorded frames.
4. **Classify the symptom using the taxonomy.** Distinguish spatial shimmer, temporal frame-time jank, opening 씹힘 or 휙휙, and stepping. Ask which Korean term fits.
5. **Separate flemo from the platform with a pure-CSS control.** Regenerate a no-`<script>` page from `compileTransitionStyles` output using the compiled keyframes, `will-change`, `contain`, and an infinite slide loop. If it reproduces without web code, stop engineering and document the external cause.
6. **Account for instrument-invisible layers.** rAF, long-task, and trace metrics observe only the main thread. Present-pipeline judder, swallowed compositor frames, bilinear shimmer, and backlight effects require pixel probes, camera video, or frame-extracted recordings. Clean metrics alongside a visible problem identify a different layer; they are not contradictory.
7. **Identify the routed tier before theorizing.** Follow the `driver-routing.md` decision tree and confirm on-device. Suppressed `animation` plus inline writes indicates the player; `data-flemo-lpm` on the root indicates governed compiled motion.
8. **Fingerprint the served bundle when testing a consumer application through tarballs.** Follow `diagnostics.md` pitfall #7 before accepting a result; several rounds used stale code.
9. **Consult the falsification list before building.** A previously rejected fix requires a new mechanism, not a rerun.
10. **Preserve authoring fidelity.** The library must not silently change authored motion: do not remove fades, flip entry suppression, or require consumer changes such as prefetching. Keep authored motion intact while changing only internal scheduling or raster work. Only an explicit user-selected trade may violate this rule.
