# (b) Layered final attributions

The campaign proved that “the jank” comprised independent layers.

## Chrome macOS present pipeline: unreachable by flemo

Residual convergence trembling on the user's M-series Mac reproduced on both 120Hz ProMotion and 60Hz 4K HiDPI external displays using a no-`<script>` pure-CSS page containing only flemo's compiled cupertino keyframes. A passive HUD reported exactly 120Hz rAF with low jitter while trembling remained visible, locating the fault below rAF in scanout or present pacing.

Chromium tracks the CVDisplayLink→CADisplayLink migration in issues **40062488** and **345275139**. The `kCADisplayLink` flag requires macOS 14+ and was default-off during the campaign.

The “sticky smooth” state occurred when the GPU process switched to continuous even presentation. Only browser-process per-vsync drawing, such as the DevTools FPS meter or `--show-fps-counter`, triggered it; page frame submission cannot. For development, demos, or recording only, use `killall "Google Chrome"; open -na "Google Chrome" --args --show-fps-counter`.

Do not investigate this again in web code; consult the falsification list.

## Sub-pixel bilinear resampling: reachable by flemo

Blink composites transformed layers at fractional device-pixel offsets with bilinear filtering. The decelerating tail holds phases long enough for texture and glyph sharpness to pulse. Static fractional-offset tests measured energy 0.251 at phase 0 versus 0.030 at 0.5; shift-compensated captures of integer-stepped layers differed by exactly zero.

Mitigations are translate3d-only compilation, the player's snap gate and landing governor, and governed landing easing in the compiled tier. Full-transition snapping was judged worse than fractional glide twice, following the same physics as the author's historical 2D-versus-3D `transformPart` verdict. It remains opt-in as `flemo:landing-snap`.

At the application layer, Skia dithers CSS gradients. Moving a screen-sized gradient decorrelates its grain field at every 1px step, independent of duration and proportional to area. Consumer applications fixed this by baking gradients into bitmaps so grain stays texture-anchored.

## Mount-commit opening stalls: settle gate and holds

Rendering and committing a heavy entering screen can occupy the main thread for hundreds of milliseconds; no driver can hide that work. Doing it before the transition yields start latency but a full-duration transition with real content; doing it during the transition swallows the opening.

Device testing rejected waiting for data (“게이트 접근 최종 기각”) but accepted a render-settle-only wait: `renderSettleOnly: true` waits for commit quiescence and never for data. It is enabled by default for touch WebKit and was validated on a demoted Note 9, where a 290ms mount task even stalls initial compositor layerization.

## Image decode: offloader and auto-gate

WebKit synchronously decodes 37-megapixel originals on the main thread even in 44px display slots. The offloader fetches, decodes, and downsizes oversized CORS-readable sources off-main.

On Note 9, off-main decode and raster landed mid-slide, causing late content paint. Timing, hiding, and scrubbing fixes were all falsified on-device; only pixel reduction worked. PR #252 therefore auto-gates the offloader with `isLegacyAndroidBlink()`. `decoding="async"` stamping through `imageDecodeHygiene` covers other images.

## Device-emulation observation trap

Weeks of residual 버벅/지글임 came from the DevTools device toolbar's scaled-rendering path. “Responsive 603×735” in the user's phone video was the clue; disabling emulation and using a narrow window produced “부드럽네요”. `emulationNotice.ts` now guards this case, also covered by debugging checklist item 1.

## Display hardware

One residue came from MacBook Pro 14 XDR mini-LED local dimming following a bright moving panel. This backlight-level effect was invisible to captures and browser-independent. Environment attribution changed until the docked external-display setup was established, reinforcing debugging checklist item 1.

## Other independent bugs and fixes

- Cold-profile GPU pipeline compilation stalls: `gpuPipelinePrewarm`.
- COMPLETED-flip layer-demotion repaint: `layerSettleHold`.
- Swipe-settle takeover race, where edge-zone taps with 1–5px wobble became grabs: 6px tap slop and `settleScrubber.takeover`.
- Stale-resolver double resolution: captured task IDs.
- Page-wide swipe recognizer claiming Android vertical-fling jitter and committing a cancelled pointer: 8px intent slop, a 3:1 axis lock, and neutral cancellation.
- Transition-time `pointer-events: none` stranding a touch on the covered screen: hit-testable destination and click-only capture gate.
- Compositor wake-up loss: warm-up and interaction warm.
