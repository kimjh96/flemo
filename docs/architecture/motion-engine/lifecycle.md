# Flight lifecycle

`ScreenMotion.tsx` renders declarative state. `createTransitionEngine.ts` and `driveScreenLifecycle` own imperative behavior.

## Hold and park before release

During render, the binding computes `holdKey` through `screen/animStartAnchor.ts` and stamps `data-flemo-anim-hold` on the scope, shared bars, and decorator in the status-changing commit. `ANIM_HOLD_RULE` applies `animation-play-state: paused !important`; `fill: both` preserves the `from` pose. This prevents iOS WebKit from aging a CSS animation while a heavy first frame remains unpresented.

`ScreenMotion.holdAttr` values:

- `"true"`: pause at the `from` pose.
- `"park"`: place a COVERED passive pop destination at its destination pose for hold-time rasterization. Requires a verifiably opaque covering background from the `ScreenSurface` registry.
- `"park-under"`: place an ACTIVE push or replace entrant at its destination beneath the previous screen with `zIndex: -1` on the outer container. Requires opaque cover. Withhold the entering initial inline style while parked because it would override the park rule.
- `"park-over"`: place the destination pose above the prior screen at `opacity: 0.02` to raster entering tiles before flight. This is a computed default for touch WebKit (`parkOver` in `platform/profile.ts`).

`scheduleAnimHoldRelease` and `createAnimHoldCoordinator` provide double-rAF scheduling, image-decode readiness, and a pop-pair barrier releasing both screens on one clock.

The optional render-settle gate is default-on for touch WebKit, touch Blink, and the steady-60 desktop profile through `readSettleGateFlag()`. It waits only for entering-screen render commits to quiesce, never for data, with `firstWaitMs` 120, `capMs` 700, `graceMs` 60, and `renderSettleOnly: true`.

The gate runs on every engine for the active PUSHING or POPPING side and the INACTIVE returning pop screen. The returning side uses `minNodes: 1`; the active side uses 30. REPLACING is ungated. The gate protects only flight start: a block during a compiled flight still ages its wall clock.

For non-Blink, authored `driver:"native"` pins, and governed-compiled touch WebKit, the release callback directly writes `data-flemo-anim-hold="false"` in the readiness rAF and clears the `park-under` z-index in that frame, making clock anchoring and first paint atomic.

## Release and flight

When `animHoldReleased` becomes true, the engine effect reruns and the compiled animation starts.

From the first transitional commit, not release, the engine arms cold-side protection for the push/replace entrant or returning pop screen:

- `arrivalHold`: a `MutationObserver` hides mid-flight swaps and additions through `[data-flemo-held-arrival] { display: none !important }`, then reflects them in one rest commit. Early arming is necessary because a release-frame commit can age the compiled clock.
- `invisibleAnimationHold`: pauses invisible consumer animations, including culled skeleton shimmer subtrees whose first composite can stall presentation.
- `responseHold`: patches `window.fetch` to park mid-flight response resolutions for every method except streams, then releases them as one rest batch. Its backstop is the full choreography span plus 1500 ms.
- `beginFlightWindow`: exposes a global latch so out-of-engine systems, including the image-decode offloader, defer reveals until rest.

`stampAsyncImageDecode` runs for every active or passive participant before any early-return branch. `holdParticipantLayers` pins compiled `will-change` and `contain` promotions inline for the flight and stamps desktop-Blink governed landing easing.

Compiled Blink flights also start a lazy, session-persistent no-op rAF frame-pacing keepalive and the display-interval probe: Chrome on macOS ProMotion presents unevenly when the main thread is idle.

## Perceptual cut and early landing

`perceptualSpan.ts` permits resolution only after every animated channel of every participant—active, passive, parts, and decorator—has permanently entered its imperceptibility band: less than one device pixel or one alpha step remains. Any unanalyzable participant vetoes the cut.

On the compiled path, a wall-clock cut timer starts at release. Cancel-resume, watchdog, or stall-shift recovery disarms it. Governed touch-WebKit tiers never arm it because presentation does not reliably follow wall time and could visibly snap.

Early landing releases the arrival hold when every participant is within one CSS pixel or alpha step, using a DPR-1 band at or before the cut. This places reveal layout and paint beneath the subpixel tail. It follows the cut's disarm rules.

## Completion, landing clear, and layer settle

A clean end delays the COMPLETED flip by `LANDING_CLEAR_FRAMES = 4` rAFs, with a 100 ms background-tab fallback, so final motion reaches the display before the busy completion commit. `resolveAfterChoreography` first waits the uncapped `choreographyExtraMs` for any participant authored longer than the active screen. Recovery paths resolve immediately.

The COMPLETED effect force-clears inline residue on the scope, parts, and decorator. Bars use owner-scoped clearing because swipe and engine drivers share them. It then explicitly strips scope pose channels with `clearInlineAnimation(scope, ["transform", "opacity"])`, ensuring compiled rest rules own the landed scope. Passive screens perform equivalent cleanup in their COMPLETED branch. A frozen previous screen is cleaned by the flight's own teardown because Activity freezes it in the same commit, preventing its COMPLETED effect.

`scheduleLanding` releases arrival, response, image, and flight-window holds together two rAFs after COMPLETED. Interruptions release immediately. A new navigation inside this pending window first calls `landNow()`.

`layerSettleHold` keeps participant compositor promotions pinned until `LAYER_SETTLE_MS` after the flip and until the flight window is idle, avoiding a full-viewport demotion repaint on convergence frames.
