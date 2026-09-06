# The flemo motion engine

Audience: coding agents changing `packages/core/src/core/engine/`. Module header comments remain authoritative for device history; this page is the map, not the record.

Companions: [flight routing](./driver-routing.md), [diagnostics](../instructions/diagnostics.md), and the [motion-jank postmortem](../instructions/motion-jank-postmortem.md).

## One tier

Every flight is driven by the compiled compositor CSS. `compileTransitionStyles.ts` produces the `@keyframes` and variant rules the React binding injects through `useTransitionStyles`, matching `data-flemo-status`, `data-flemo-active` and `data-flemo-transition`. The browser's animation machinery is compositor-driven on Blink and main-thread-presented on WebKit.

The rAF motion player, its scrub-WAAPI sub-tier and the routing that chose between them were retired in 2026-08. `@flemo/devtools` still classifies a flight as `inline` when it sees per-frame inline writes on a screen, and that signature no longer comes from the library: seeing it means something else is writing frames onto a screen.

What is still routed is the flight's OPENING and whether the engine may touch its clock. See [flight routing](./driver-routing.md).

## Flight lifecycle

`ScreenMotion.tsx` renders declarative state. `createTransitionEngine.ts` and `driveScreenLifecycle` own imperative behavior.

### Hold and park before release

During render, the binding computes `holdKey` through `screen/animStartAnchor.ts` and stamps `data-flemo-anim-hold` on the scope, shared bars, and decorator in the same commit that changes status. `ANIM_HOLD_RULE` applies `animation-play-state: paused !important`; `fill: both` preserves the `from` pose. This prevents iOS WebKit from aging a CSS animation while a heavy first frame is not presented.

`ScreenMotion.holdAttr` values are:

- `"true"`: pause at the `from` pose.
- `"park"`: put a COVERED passive pop destination at its destination pose for hold-time rasterization. This requires a verifiably opaque covering background from the `ScreenSurface` registry.
- `"park-under"`: put an ACTIVE push or replace entrant at its destination beneath the previous screen using `zIndex: -1` on the outer container. This also requires opaque cover. The entering initial inline style is withheld while parked because it would override the park rule.
- `"park-over"`: destination pose above the prior screen at `opacity: 0.02`, so the entering tiles are rastered before the flight. A computed default for touch WebKit (`parkOver` in `platform/profile.ts`).

`scheduleAnimHoldRelease` and `createAnimHoldCoordinator` provide double-rAF scheduling, image-decode readiness, and a pop-pair barrier that releases both screens on one clock. The optional render-settle gate is default-on for touch WebKit, touch Blink, and the steady-60 desktop profile through `readSettleGateFlag()`. It waits only for entering-screen render commits to quiesce, never for data, using `firstWaitMs` 120, `capMs` 700, `graceMs` 60, and `renderSettleOnly: true`.

The gate runs on every engine for the active PUSHING or POPPING side and the INACTIVE returning pop screen. The returning side uses `minNodes: 1`; the active side uses 30. REPLACING is ungated. The gate protects only flight start; a block during a compiled flight still ages its wall clock.

For non-Blink, authored `driver:"native"` pins, and governed-compiled touch WebKit, the release callback directly writes `data-flemo-anim-hold="false"` in the readiness rAF and clears the `park-under` z-index in that frame. This makes clock anchoring and first paint atomic.

### Release and flight

When `animHoldReleased` becomes true, the engine effect reruns and the compiled animation starts.

From the first transitional commit, not release, the engine arms cold-side protection for the push/replace entrant or returning pop screen:

- `arrivalHold`: a `MutationObserver` hides mid-flight swaps and additions through `[data-flemo-held-arrival] { display: none !important }`, then reflects them in one rest commit. It is armed early because a release-frame commit can age the compiled clock.
- `invisibleAnimationHold`: pauses invisible consumer animations, including culled skeleton shimmer subtrees whose first composite can stall presentation.
- `responseHold`: patches `window.fetch` to park mid-flight response resolutions for every method except streams, then releases them as one rest batch. Its backstop is the full choreography span plus 1500 ms.
- `beginFlightWindow`: exposes a global latch so out-of-engine systems, including the image-decode offloader, defer reveals until rest.

`stampAsyncImageDecode` runs for every active or passive participant before any early-return branch. `holdParticipantLayers` pins compiled `will-change` and `contain` promotions inline for the flight and stamps desktop-Blink governed landing easing.

Compiled Blink flights also start a lazy, session-persistent no-op rAF frame-pacing keepalive and the display-interval probe. Chrome on macOS ProMotion presents unevenly when the main thread is idle.

### Perceptual cut and early landing

`perceptualSpan.ts` permits resolution only after every animated channel of every participant—active, passive, parts, and decorator—has permanently entered its imperceptibility band: less than one device pixel or one alpha step remains. Any unanalyzable participant vetoes the cut.

On the compiled path, a wall-clock cut timer starts at release. Cancel-resume, watchdog, or stall-shift recovery disarms it. Governed touch-WebKit tiers never arm it because their presentation does not reliably follow wall time and could visibly snap.

Early landing releases the arrival hold when every participant is within one CSS pixel or alpha step, using a DPR-1 band at or before the cut. This places reveal layout and paint beneath the subpixel tail. It follows the cut's disarm rules.

### Completion, landing clear, and layer settle

A clean end delays the COMPLETED flip by `LANDING_CLEAR_FRAMES = 4` rAFs, with a 100 ms background-tab fallback, so final motion reaches the display before the busy completion commit. `resolveAfterChoreography` first waits the uncapped `choreographyExtraMs` for any participant authored longer than the active screen. Recovery paths resolve immediately.

The COMPLETED effect force-clears inline residue on the scope, parts, and decorator. Bars use owner-scoped clearing because swipe and engine drivers share them. It then explicitly strips the scope pose channels with `clearInlineAnimation(scope, ["transform", "opacity"])`, ensuring compiled rest rules own the landed scope. Passive screens perform equivalent cleanup in their COMPLETED branch. A frozen previous screen is cleaned by the flight's own teardown because Activity freezes it in the same commit, preventing its COMPLETED effect.

`scheduleLanding` releases arrival, response, image, and flight-window holds together two rAFs after COMPLETED. Interruptions release immediately. A new navigation inside this pending window first calls `landNow()`.

`layerSettleHold` keeps participant compositor promotions pinned until `LAYER_SETTLE_MS` after the flip and until the flight window is idle, avoiding a full-viewport demotion repaint on convergence frames.

## Inline leases

`transition/animateInline.ts` tracks every flemo inline CSS write in a WeakMap as `property → { original, owners: Set<symbol> }`.

- Call `trackInlineWrite(el, property, owner)` before writing. The first lease captures the current inline value as `original`; later writes retain that capture and add owners.
- `clearInlineAnimation(el, properties?, owner?)` restores the captured original instead of deleting it, preserving consumer values such as `animation-delay: 0.2s`. Owner-scoped clearing removes only that owner's stake and restores after the final owner leaves. Ownerless clearing is the force form used by COMPLETED, where the flight is over by definition. Without a property list, it releases all leased properties; if the lease map is empty, it falls back to stripping `transform` and `opacity`.
- Multiple owners are required because a swipe settle and an engine flight can co-write shared bars. A single owner would let the first finisher snap the element away from the other. Inline `transition` uses a separate single-value `transitionWriters` tag.

### PR #259 invariant

`enteringInitialStyle` renders flemo's entering `from` pose inline, such as `transform: translate3d(100%,0,0)` for a Cupertino push. Anything leasing `transform` therefore captures a flemo-authored value rather than a consumer value.

A teardown that restored the `from` pose at COMPLETED and removed its lease entry left a later force clear iterating only the remaining keys, while the empty-map fallback did not run if another lease survived. A screen could therefore land at `translateX(100%)`, leaving a blank viewport. Touch worked only because its lease map was empty. The rule the fix left behind is the invariant: COMPLETED strips the pose channels explicitly rather than trusting the lease map to be empty.

PR #259, merged 2026-08-17, fixed this by explicitly clearing `transform` and `opacity` after force clearing, allowing the desktop rAF pin again. The invariant is: an original captured from a flemo-rendered inline style is not a consumer value; compiled rest rules own the landed scope.

## Module inventory

### `packages/core/src/core/engine/`

| Module | Responsibility |
| --- | --- |
| `createTransitionEngine.ts` | Per-screen lifecycle conductor: hold and armor setup, resolution, and COMPLETED cleanup. Its routing comments are the campaign ledger and must be read before changing routing. |
| `flightRouting.ts` | Which opening treatment a flight gets and whether the engine may touch its clock. Shares `resolveHeadKit` with the morph runtime so the two cannot drift. |
| `arrivalHold.ts` | Holds mid-flight swaps, additions, and in-place writes, then reflects them at rest under the delayed-but-complete contract. |
| `responseHold.ts` | Parks nonstream fetch resolutions for all methods and delivers them in one rest batch. |
| `invisibleAnimationHold.ts` | Pauses invisible consumer animations during flights. |
| `imageDecodeHygiene.ts` | Adds `decoding="async"` to participant images while respecting authored attributes. |
| `imageDecodeOffloader.ts` | Off-main decode-to-scale for oversized images, gated on the image rather than the device. |
| `flightWindow.ts` | Global nestable flight-in-progress latch. |
| `layerSettleHold.ts` | Pins promotions and defers demotion until the flight window is idle. |
| `gpuPipelinePrewarm.ts` | One-shot boot-idle probes that compile Chrome Graphite GPU pipelines before the first flight. |
| `steadySixtyCadence.ts` | Desktop-profile cadence verdict for settle gating, unpainted image hold, and rest promotion. It does not route drivers; desktop uses compiled motion. |
| `perceptualSpan.ts` | `perceptualCutMs` and `channelValue` imperceptibility math, shared by the cut and early landing. |
| `nativeStallAnchor.ts` | Main-thread-presenting native-clock correction: birth-window `startTime` rewind, authored-native first-frame pause/play, and authored-pin continuous stall watching. |
| `emulationNotice.ts` | Once-per-session warning for DevTools device emulation, whose scaled surface fabricates shimmer. |
| `createSwipeController.ts` | Framework-neutral swipe back: 8 px intent slop, 3:1 axis arbitration before ownership, the declared drag staged as scrubbed animations on the screens and the bars riding them, inline mirroring for a transition that drives its own screens, 6 px release tap slop, and shared layer promotion. Whoever owns the screens owns the release. |
| `types.ts` | Minimal `TransitionEngineDeps` interface and `SKIP_ANIMATION_ATTR`. |

### Related modules outside `engine/`

| Module | Responsibility |
| --- | --- |
| `screen/animStartAnchor.ts` | `animHoldKey`, `scheduleAnimHoldRelease`, decode readiness, render-settle gating, and `createAnimHoldCoordinator`. |
| `screen/pendingNetwork.ts` | In-flight request accounting that distinguishes loading from completed work without consumer declarations. |
| `transition/gestureScrub.ts` | Staging, scrubbing and settling the paused animations a gesture drives, for the screens, the bars, the dim and the parts alike. |
| `transition/variantMotion.ts` | `resolveVariantMotion`, the single source for variant `{from, to, via, duration, delay, ease}` values. |
| `transition/resolveSwipeOptions.ts` | The swipe a transition declares, with its defaults filled in, so nothing downstream resolves them twice. |
| `transition/animateInline.ts` | Inline leases and imperative swipe writes. |
| `transition/compileTransitionStyles.ts` | Keyframe compiler, promotion scoping, hold and arrival rules, and LPM `-lpm` flat-head keyframes using `LPM_HEAD_MS` 180/100/80 behind `:root[data-flemo-lpm]`. Uses only `translate3d`; 2D transforms pixel-snap-stutter on Blink. Timing must remain literal because `calc(var())` animation timing demotes WebKit fades to the main thread. |
| `transition/enteringInitialStyle.ts` | Inline `from` pose for the entering screen's first styled frame; subject to the PR #259 lease invariant. |

## Single-resolution contract

Exactly one live path resolves a flight's `TaskManager` navigation task. `resolveTask` ignores noncurrent IDs. Every resolver captures `flooredTaskId` when armed so stale work cannot resolve a newer flight.

1. `animationend` is wired from the first transitional render and accepts the `-lpm` name. It cannot fire while hold pauses animation.
2. The compiled perceptual cut detaches `animationend` before calling `resolvePresented`.
3. WebKit `animationcancel` recovery uses `wireCancelResume` to rejoin the original timeline up to `RESUME_BUDGET = 4` times per task ID, not per effect. If no signal arrives, the watchdog replays once from `from` and resolves. Recovery disarms wall-clock cut and early landing because presentation has shifted.
4. The liveness floor resolves the captured task ID after `max(motionSpan, participantSpan) + 1500ms`, preventing a rapid storm that orphans an element from deadlocking the serial queue.
5. `TaskManager.anchorGate` and `markGateHeld` are the final backstop. They rearm while hold remains active so a long entering commit cannot cause a transition-less cut, and use the choreography span so long authored motion is not truncated.

Resolution targets the live queue, so duplicate resolution can finish its deferred two-rAF landing-clear and choreography chain after the next task starts, cutting that newer navigation. This appeared in campaign R19-v3 as a fast-back pop reaching COMPLETED at about 90 ms with no motion. Any new completion path must capture and resolve its own task ID or be provably suppressed while another path is live.
