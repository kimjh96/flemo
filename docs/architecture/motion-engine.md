# The flemo motion engine

Audience: a coding agent landing changes in `packages/core/src/core/engine/` for the
first time. Everything here is verified against the code as of 2026-08-17 (main at
`46a2b00`, post-PR #257/#258/#259). Where a claim has device history behind it, the module's own
header comment is the primary source — this file is the map, the comments are the
territory. Companion documents: [driver-routing.md](./driver-routing.md) (the routing
decision tree), [../diagnostics.md](../diagnostics.md) (every `flemo:*` toggle),
[../postmortems/2026-08-motion-jank.md](../postmortems/2026-08-motion-jank.md) (why the
engine looks like this, and what must not be re-attempted).

## 1. The driver-tier model

One navigation ("flight") is driven by exactly one of three value-application tiers.
The library picks the tier per flight; consumers never do, and there is **no mid-flight
driver switching** (different clocks, easing evaluation, and write paths — any handoff
during motion risks a visible seam; the one exception, the anchored-opening handoff, is
a diagnostic opt-in, see below).

1. **Compiled compositor CSS** (`compileTransitionStyles.ts` → `<style>` injected by the
   react binding's `useTransitionStyles`). `@keyframes` + variant-scoped rules matched on
   `data-flemo-status` / `data-flemo-active` / `data-flemo-transition` attributes.
   Runs on the browser's animation machinery — compositor-driven on Blink,
   main-thread-presented on WebKit (a measured fact that shapes all routing).
   **Production tier** on: desktop Blink, desktop WebKit, touch WebKit (the
   "governed-compiled" treatment), high-refresh/demoted/legacy touch Blink.
2. **rAF player** (`transitionPlayer.ts`). Every participant of the navigation (entering
   screen, exiting screen, dim decorator, riding bars, `<Part>`s) joins one player keyed
   by the navigation task id and steps off one shared clock; per-frame inline style
   writes with velocity-gated device-pixel snapping and a landing governor. The clock is
   _capped_: a main-thread stall advances it exactly one display frame (no velocity
   discontinuity on resume), and the excess re-anchors — flights are
   delayed-but-complete, never jumped. **Production tier** on: touch Blink
   (modern devices at ordinary refresh). Diagnostic tier everywhere else via the
   `flemo:motion-driver-force` pin.
3. **Scrub-WAAPI application** (inside `transitionPlayer.ts`): motion the numeric parser
   cannot faithfully interpolate (calc(), mixed units, non-canonical transform order,
   clip-path templates…) is driven as a _paused_ `element.animate()` whose `currentTime`
   the player writes each frame — browser-exact interpolation, player-owned clock. This
   is a sub-tier of the player, not a separate routing target; `flemo:apply=scrub`
   forces every track through it for A/B work.

Where each tier is production vs diagnostic is the routing decision tree — see
[driver-routing.md](./driver-routing.md).

## 2. Flight lifecycle, end to end

The react binding (`ScreenMotion.tsx`) renders declarative state; the engine
(`createTransitionEngine.ts` → `driveScreenLifecycle`) owns everything imperative.
Chronologically:

### Hold / park (pre-release)

- The binding computes `holdKey` (`animHoldKey`, core `screen/animStartAnchor.ts`) in
  RENDER and stamps `data-flemo-anim-hold` on scope, shared bars, and decorator in the
  same commit that flips the status attribute. The compiled `ANIM_HOLD_RULE` pins
  `animation-play-state: paused !important`; `fill: both` keeps the `from` pose applied.
  Purpose: iOS WebKit anchors a CSS animation's timeline when the style change commits —
  a heavy first frame would otherwise age the clock while nothing is presented (the
  swallowed opening).
- Hold attribute values (`ScreenMotion.holdAttr`):
  - `"true"` — paused at the `from` pose.
  - `"park"` — a COVERED passive screen (pop destination) parks at its _destination_
    pose so its tiles rasterize during the hold. Gated on the covering screen's
    verifiably opaque background (`ScreenSurface` registry).
  - `"park-under"` — the push/replace-side mirror: the ACTIVE entering screen parks at
    its destination but z-ordered _beneath_ the previous screen (the `zIndex: -1` on the
    outer screen container). Also gated on the cover's opacity. While parked, the
    entering-initial inline style is withheld (it would override the park rule).
  - `"park-over"` — diagnostic only (`flemo:preraster=on`): destination pose on top at
    `opacity: 0.02`.
- Release scheduling lives in core (`scheduleAnimHoldRelease` +
  `createAnimHoldCoordinator`): double-rAF + image-decode readiness, a pop _pair
  barrier_ (both screens of a pop release together on one clock), and the optional
  **render-settle gate** (`contentSettle`, default-on for touch WebKit, touch Blink
  and the steady-60 desktop profile via `readSettleGateFlag()`): holds the release
  until the entering screen's mount render storm quiesces (firstWaitMs 120 / capMs
  700 / graceMs 60, `renderSettleOnly: true` — it waits on _render_ commits, never on
  data). Runs on **all engines** for the active side of PUSHING/POPPING **and for the
  INACTIVE returning screen of a pop**, whose unfreeze storm is node-light, so it
  carries `minNodes: 1` where the active side uses 30; REPLACING stays ungated. Note
  the gate only protects the START of a flight — a block landing mid-flight ages a
  wall-clocked compiled animation regardless.
- **Atomic release flip**: on non-Blink, for authored `driver:"native"` pins and for the
  governed-compiled touch-WebKit tier, the release callback writes
  `data-flemo-anim-hold="false"` directly on the DOM inside the readiness rAF (rAF →
  same-frame rendering update is atomic, so no task can stretch the gap between the
  compiled clock's anchor and first paint), and clears the park-under zIndex in the same
  frame. Player-routed flights keep the state-only path (an early compiled start would
  play frames the player then restarts).

### Release → flight

- The engine effect re-runs with `animHoldReleased: true`. `joinPlayer` decides the
  tier (see driver-routing.md). If the player joins, it suppresses the compiled
  animation (`animation: none`, inline, leased) and pins frame 0 synchronously in the
  join commit.
- From the FIRST transitional commit (not release), the engine arms the in-flight
  armor on the cold side of the navigation (entering screen on push/replace, returning
  screen on pop):
  - **arrivalHold** — MutationObserver holds mid-flight DOM swaps/additions off-glass
    (compiled `[data-flemo-held-arrival] { display: none !important }` rule) and
    reflects everything in one commit at rest. Armed early because a commit landing in
    the _release frame's_ own rendering update ages the compiled clock.
  - **invisibleAnimationHold** — pauses invisible consumer animations (the culled
    skeleton-shimmer subtree whose mid-flight first composite stalls presentation).
  - **responseHold** — a patched `window.fetch` parks mid-flight response
    _resolutions_ (every method, streams excluded) and delivers them in one batch at
    rest; moves the reveal's React render (script cost `display:none` can't touch) out
    of the flight. Backstopped by the whole choreography span + 1500ms.
  - **imageRevealHold** — the `<img>` analog. Default ON (strictly-unpainted images
    only) on the steady-60 desktop profile since 2026-08-18; elsewhere opt-in
    (`flemo:imghold=on`, WebKit
    got worse with it on).
  - **beginFlightWindow** — global latch for out-of-engine machinery (the image decode
    offloader defers reveals to the same rest).
  - `settleScrubber.takeover(scope)` — a navigation owns its participants: any running
    swipe-settle WAAPI is concluded before the flight drives (it would outrank both
    compiled rules and player inline writes — the "settle race" bug, real-device).
- `stampAsyncImageDecode` runs for EVERY participant (active or passive, before any
  early-return fork); `holdParticipantLayers` pins each participant's compiled
  `will-change`/`contain` promotions inline for the flight (see layerSettleHold below)
  and stamps the desktop-Blink governed landing easing.
- Compiled Blink flights additionally arm a **frame-pacing keepalive** (a do-nothing
  rAF loop, started lazily and then never stopped for the session — Chrome's macOS
  ProMotion presentation paces unevenly when main is idle) and the display-interval
  probe.

### Perceptual cut / early landing (the tail)

- **Perceptual cut** (`perceptualSpan.ts`): once every animated channel of every
  participant (active, passive, parts, decorator) has permanently entered its
  imperceptibility band (< 1 device pixel / < one alpha step remaining), the rest of the
  clock is dead air — resolve there. Compiled path: a wall-clock timer armed at release,
  DISARMED by any recovery event (cancel-resume, watchdog, stall shift) and _not armed
  at all_ on the governed touch-WebKit tiers (wall-clock timers assume presentation
  tracks the wall clock; on touch WebKit it doesn't — the cut would snap a visibly
  mid-flight screen). Any unanalyzable participant vetoes. Player path: the same cut on
  the player's own capped clock (`navCutMs`, max over tracks, null-veto), which shifts
  with presentation by construction; the cut frame _writes the rest pose_ and a
  landing-governor track stays live until its presented pose has actually landed
  (`pendingLanding`).
- **Early landing**: the arrival hold's release fires when every participant is within
  one _CSS_ pixel / alpha step (dpr=1 band — at or before the cut), so the reveal
  commit's layout/paint hides under the playing sub-pixel tail instead of stacking on
  the convergence. Same disarm rules as the cut, plus a stand-down on the steady-60
  desktop profile (`!steadySixtyPlayerEligible()`).
- **Landing governor** (player, `composeTransform`): a decelerating tail that can no
  longer sustain 1 device px/frame inside the last ~12 device px is closed at exactly
  one device pixel per frame — monotone, no park-then-tick.

### COMPLETED flip → landing clear → layer settle

- A clean end defers the COMPLETED flip by `LANDING_CLEAR_FRAMES = 4` rAFs (100ms
  timeout fallback for background tabs) so the motion's last frames reach the glass
  before the flip's busy commit; `resolveAfterChoreography` first waits out any
  participant authored longer than the active screen (`choreographyExtraMs`, uncapped).
  Recovery paths resolve immediately — something is already wrong there.
- The COMPLETED effect strips inline residue: `clearInlineAnimation` force-form on scope
  - parts + decorator, owner-scoped on bars (bars are the one participant class shared
    across drivers — swipe and engine both promote them), then an explicit strip of the
    scope's pose channels (`transform`, `opacity`) — the landed scope belongs to the
    compiled rest rules unconditionally (the PR #259 fix; see section 3). Passive screens get the same
    cleanup in their own COMPLETED branch; a _frozen_ prev screen's cleanup runs in the
    player track's detach instead (its COMPLETED effect never runs — Activity freezes it
    in the same commit).
- The arrival/response/image/flight-window holds release together via
  `scheduleLanding` — two rAFs past COMPLETED (or immediately on interrupt; a
  navigation starting inside the pending window calls `landNow()` first).
- **layerSettleHold**: participants' pinned compositor promotions demote off-cadence,
  `LAYER_SETTLE_MS` past the flip and only once the flight window is idle — the demote
  repaint was the full-viewport flash landing exactly on the convergence frames.
  `flemo:layers=resident` keeps screen layers resident permanently (diagnostic).
- The compositor warm-up (armed at the first transitional commit) outlives COMPLETED by
  `WARM_SETTLE_MS = 400` so the convergence storm stays on the vsync cadence.

## 3. The inline lease model (`transition/animateInline.ts`)

Every inline CSS property flemo writes on an element is covered by a **lease**:
`property → { original, owners: Set<symbol> }`, in a WeakMap.

- `trackInlineWrite(el, property, owner)` — call BEFORE writing. Captures the element's
  current inline value as the _original_ the first time the property is leased (repeat
  writes keep the first capture) and stakes the writer.
- `clearInlineAnimation(el, properties?, owner?)` — RESTORES the captured original
  rather than deleting, so a consumer's own `animation-delay: 0.2s` survives a
  transition that overwrote it. Owner-scoped clears release only that writer's stake
  and restore only when the last stake is gone; the ownerless call is the **force
  form** (flight-over final authority: COMPLETED flip, player teardown). With no
  explicit property list, the force form releases every leased property, or — on an
  element with an _empty_ lease map — falls back to stripping `transform`/`opacity`.
- Writers exist because two drivers legitimately co-write one element (a swipe settle
  and the engine's player on a shared bar); a single-owner lease let whichever finished
  first snap the element out from under the other. The inline `transition` property has
  its own single-value writer tag (`transitionWriters`).

**The PR #259 lesson (lease-restore vs flemo-rendered originals).** The binding renders
the entering screen's from-pose as an _inline style_ (`enteringInitialStyle` —
`transform: translate3d(100%,0,0)` on a cupertino push). When a player track then
leases `transform`, the captured "original" is that flemo-authored from-pose, not a
consumer value — so the track detach's restore at COMPLETED re-applies the from-pose,
and the force clear that follows iterates only keys _still in the lease map_ (the
restore just dropped the transform entry) while its empty-map fallback never runs if
any other lease survives the flip (on desktop Blink the governed-easing
`animation-timing-function` lease always does, released later by
`releaseParticipantLayers`). Result on a pinned desktop player: the landed screen rests
at `translateX(100%)` — a blank viewport. Touch sessions were saved only by accident
(empty lease map at the flip → fallback strip). PR #259 (merged 2026-08-17) fixed
this: the active COMPLETED branch now strips the scope's pose channels explicitly
after the force clear — `clearInlineAnimation(scope, ["transform", "opacity"])` — and
the desktop raf-pin pierce was re-enabled on the strength of it.
General rule this encodes: **an "original" captured from a flemo-rendered inline style
is not a consumer value; the landed scope belongs to the compiled rest rules.**

## 4. Engine module inventory

`packages/core/src/core/engine/`:

| Module                      | One line                                                                                                                                                                                                                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createTransitionEngine.ts` | The conductor: per-screen lifecycle drive, tier routing (`joinPlayer`), holds/armor arming, resolution paths, COMPLETED cleanup. The routing comments are the campaign ledger — read them before touching routing.                                                                                                                             |
| `transitionPlayer.ts`       | The rAF player registry: numeric tier + scrub-WAAPI tier, capped clock, snap gate + landing governor, perceptual cut, (opt-in) anchored-opening handoff, `__flemoPlayerGaps` mirror.                                                                                                                                                           |
| `driverPolicy.ts`           | Blink detection (`detectBlinkEngine`, UA-CH brands + Android-UA fallback), `isLegacyAndroidBlink`, the demotion machinery (strikes/probation/persisted `flemo:motion-driver`), the `flemo:motion-driver-force` pin + its never-silent warning.                                                                                                 |
| `diagnosticFlags.ts`        | The `flemo:*` flag registry — every storage-backed toggle documented in one header table; cached vs uncached reader contract. Landed in PR #258.                                                                                                                                                                                               |
| `motionDriverKind.ts`       | Kind classification: authored `driver:"native"/"player"` pins; default `"player"` everywhere (the fast-mover carve-out is retired; `peakTranslationPxPerFrame` stays exported for diagnostics).                                                                                                                                                |
| `lowPowerCadence.ts`        | Isolated touch-WebKit cadence machinery: LPM probe + continuous latched monitor (`flemo:lpm`), the release-latency ledger (`flemo:lat`), and `governedCompiledActive()` — which today returns "eligible" for **every** touch-WebKit session, not only detected LPM (the governed-compiled treatment was promoted to the touch-WebKit default). |
| `lpmReleaseLatencyProbe.ts` | Read-only release→present starvation observation feeding the ledger; consumed strictly pre-birth (the one unfalsified adaptive lever).                                                                                                                                                                                                         |
| `arrivalHold.ts`            | In-flight commit hold: mid-flight swaps/additions/in-place writes held and reflected in one commit at rest (delayed-but-complete contract).                                                                                                                                                                                                    |
| `responseHold.ts`           | Flight-scoped fetch-resolution park (every method, minus streams) delivered in one batch at rest.                                                                                                                                                                                                                                              |
| `invisibleAnimationHold.ts` | Pauses invisible consumer animations for the flight (the culled-subtree first-composite stall).                                                                                                                                                                                                                                                |
| `imageRevealHold.ts`        | `<img>`-load analog of responseHold. Unpainted-only by default on the steady-60 desktop profile; `flemo:imghold` overrides both ways.                                                                                                                                                                                                          |
| `imageDecodeHygiene.ts`     | Stamps `decoding="async"` on transition participants' images (respects authored attributes).                                                                                                                                                                                                                                                   |
| `imageDecodeOffloader.ts`   | Off-main decode-to-scale for oversized images (WebKit-style sync decode reproduced at page level); auto-gated to legacy Android Blink, overridable via `flemo:imgoffload`.                                                                                                                                                                     |
| `flightWindow.ts`           | Global nestable "a flight is in progress" latch for out-of-engine modules.                                                                                                                                                                                                                                                                     |
| `layerSettleHold.ts`        | Inline-pinned compositor promotions + deferred off-cadence demotion past the flip; `flemo:layers=resident`.                                                                                                                                                                                                                                    |
| `compositorWarmUp.ts`       | Invisible 48x48 raster-class animation (a background-position sweep — it must repaint, not merely recomposite) keeping the frame cadence alive through the flight + settle window; refcounted. On the steady-60 desktop profile it also mounts a session-persistent 8x8 60fps video as a viz-level cadence lock.                               |
| `gpuPipelinePrewarm.ts`     | One-shot boot-idle probes compiling Chrome Graphite's GPU pipelines before the first flight.                                                                                                                                                                                                                                                   |
| `steadySixtyCadence.ts`     | In-flight display-cadence verdict for the desktop PROFILE (settle gate, unpainted-only image hold, warm-up video, rest promotion). It does not route the driver — desktop is settled on the compiled tier.                                                                                                                                     |
| `landingPixelSnap.ts`       | Blink compiled-tier landing treatments: governed easing (default desktop/high-refresh — sprints the sub-pixel tail at 1 device px/frame) and the opt-in full snap easing (`flemo:landing-snap`).                                                                                                                                               |
| `perceptualSpan.ts`         | The imperceptibility-band math (`perceptualCutMs`, `channelValue`) shared by the cut, the early landing, and the player.                                                                                                                                                                                                                       |
| `nativeStallAnchor.ts`      | Native-clock surgery for main-thread-presenting engines: birth-window start anchor (one-shot startTime rewind), first-frame pause/play hold (authored `driver:"native"` only), continuous stall watcher (authored pins only).                                                                                                                  |
| `emulationNotice.ts`        | Once-per-session console.warn when a transition runs under DevTools device emulation (a scaled surface that fabricates shimmer).                                                                                                                                                                                                               |
| `createSwipeController.ts`  | Framework-neutral swipe-back gesture: drag-follow inline writes, release settle via settleScrub, bar mirroring, 6px tap-slop, layer promotion sharing.                                                                                                                                                                                         |
| `types.ts`                  | The minimal injected engine interface (`TransitionEngineDeps`) + `SKIP_ANIMATION_ATTR`.                                                                                                                                                                                                                                                        |

Campaign modules **outside** `engine/`:

| Module                                  | One line                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `screen/animStartAnchor.ts`             | Framework-neutral anim-hold decision (`animHoldKey`) + release scheduling (`scheduleAnimHoldRelease`, decode readiness, render-settle gate, pop pair coordinator `createAnimHoldCoordinator`).                                                                                                                                                                                                                                  |
| `screen/pendingNetwork.ts`              | In-flight request accounting so the settle gate can tell "still loading" from "already complete" without consumer declarations.                                                                                                                                                                                                                                                                                                 |
| `transition/settleScrub.ts`             | The swipe-settle scrubber: paused single-keyframe WAAPI per release, currentTime driven off a shared main-thread clock; `takeover()` is the "a navigation owns its participants" hook.                                                                                                                                                                                                                                          |
| `transition/variantMotion.ts`           | The variant → `{from, to, duration, delay, ease}` resolver (`resolveVariantMotion`) — single source of the "where does each variant start" table.                                                                                                                                                                                                                                                                               |
| `transition/animateInline.ts`           | The inline lease model (section 3) + the imperative swipe write path.                                                                                                                                                                                                                                                                                                                                                           |
| `transition/compileTransitionStyles.ts` | The keyframes compiler: variant rules, `will-change`/`contain` scoping, hold/park/park-under/park-over rules, ARRIVAL_HOLD rule, the LPM flat-head `-lpm` keyframes (`LPM_HEAD_MS` 180/100/80) behind `:root[data-flemo-lpm]`, translate3d-only transforms (2D forms pixel-snap-stutter on Blink). Timing is LITERAL by contract — `calc(var())` in animation timing demotes WebKit fades to the main thread (device-bisected). |
| `transition/enteringInitialStyle.ts`    | The actively-entering screen's inline from-pose for its first styled frame (see the PR #259 lease hazard above).                                                                                                                                                                                                                                                                                                                |

## 5. Who resolves a flight — "never a double resolution"

A flight's navigation task (`TaskManger`) is resolved by exactly ONE live path; every
other path is a backstop that is a no-op once the task settled (`resolveTask` ignores
non-current ids, and every resolver captures `flooredTaskId` at arm time so a stale
resolver can never cut a NEWER flight).

1. **`animationend`** — the always-wired resolver, attached from the first transitional
   render whatever the driver (also accepts the `-lpm` flat-head name). While the hold
   pauses the animation it cannot fire; when the player joins, its `animation: none`
   suppression means it _never_ fires — no double, no gap.
2. **Player `onComplete`** (`resolvePresented` passed into `joinPlayer`) — fires once
   EVERY track has finished on the player's own capped clock (or at the player's own
   perceptual cut). On the diagnostic handoff path the remainder animation's `finish`
   event is the single resolver; the compiled animation stays suppressed all flight.
3. **Perceptual cut** (compiled path) — a clean completion: detaches `animationend`,
   then `resolvePresented`.
4. **Cancel-resume terminal / watchdog** — WebKit silently cancels compositor
   animations on layer churn (`animationcancel`, never `animationend`);
   `wireCancelResume` re-joins the original timeline up to `RESUME_BUDGET = 4` times
   (budget per task id, not per effect run), and the watchdog replays once from `from`
   if NO signal arrived, then resolves. Recovery events disarm the cut and early
   landing (presentation has shifted off the wall clock).
5. **Liveness floor** — `max(motionSpan, participantSpan) + 1500ms` timeout resolving
   the captured task id: the guarantee that a rapid storm orphaning the element can
   never deadlock the serial task queue.
6. **Task gate backstop** (`TaskManger.anchorGate` / `markGateHeld`) — the last resort;
   re-arms while the hold is on so a long entering-commit block can't fire it into a
   transition-less cut, and is anchored with the choreography's own span so long
   authored motions are never truncated.

Why the invariant is hard: task resolution targets the _live queue_ — a duplicate
resolution's deferred chain (2-rAF landing clear + choreography timer) lands frames
later, where it hits the NEXT task and cuts that navigation (device-measured: a fast
back's pop flipping COMPLETED at ~90ms with zero motion, R19-v3 of the campaign).
When you add any completion path, it must either capture-and-resolve its own task id or
be provably suppressed while another path is live.
