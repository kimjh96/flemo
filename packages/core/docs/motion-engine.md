# The flemo motion engine

Audience: someone landing a change in `packages/core/src/core/engine/` or writing a
binding for a framework other than React.

This file is the MAP. The modules' own header comments are the TERRITORY — where a
claim has device history behind it, the comment beside the code is the primary source
and this file only says where to look.

**It is checked.** `packages/core/src/core/engine/__tests__/architectureDoc.test.ts`
asserts that every module named in the inventory below exists and that every module
under `core/engine/`, `platform/` and `dom/` appears in it. The previous version of
this file sat untracked for a release cycle and ended up describing two modules that
had been deleted; that failure mode is now a failing test.

## 1. One driver, and what varies per flight

Every flight is driven by the **compiled compositor CSS**: `compileTransitionStyles.ts`
emits `@keyframes` plus variant-scoped rules matched on the `data-flemo-*` attributes
the binding renders (see `dom/attributes.ts` for the whole protocol), and the binding
injects them. The browser's own animation machinery plays them — compositor-driven on
Blink, **presented from the main thread on WebKit**, a measured fact that shapes
everything below.

There is no second driver. An rAF player shared this job until 2026-08; it was retired
once the routing sent every supported browser to the compiled tier anyway. Do not
reintroduce a per-frame writer without reading `platform/engineProbes.ts`'s header
first — it records what that cost.

What DOES vary per flight is how the flight's **opening** is protected, because the
compiled clock is stamped when the style change commits: a heavy first frame ages it
while nothing is presented, and the transition reads as abbreviated (the "swallowed
opening"). Two questions decide the treatment, and each is answered in one place:

| question                          | answered by                                               | returns                                                                                                                                      |
| --------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| what kind of browser is this?     | `platform/profile.ts` — `resolvePlatformProfile()`        | the atomic release flip, the render-settle gate, the deferred release commit, the park variant, the rest promotion, the image-decode offload |
| so what does THIS navigation get? | `core/engine/flightRouting.ts` — `resolveFlightRouting()` | the governed / desktop head and its length, whether clock surgery is allowed, the frame-pacing keepalive                                     |

Neither is cached: both read their flags live, so a DevTools toggle lands on the next
navigation. A binding asks and renders; it never re-derives either. (It used to, and
core and the binding disagreed about the settle gate for two release cycles.)

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
  - `"park-over"` — touch WebKit (the profile's `parkOver`): destination pose on top at
    `opacity: 0.02`, so the browser genuinely paints the entering tiles during the hold.
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
- **Outer `<Part>` holds**: the compiled hold rule pauses held elements and their
  `[data-flemo-part-name]` descendants, which covers a Part inside a screen and a Part
  inside a shared bar (the binding stamps the attribute on both). A Part mounted
  outside any screen — the position `<Part>` supports on purpose (persistent chrome
  beside a `<Slot>`, a portal) — has neither, while the compiled part selector still
  drives it (name + status + active, no structural term). The engine stamps the hold on
  it directly for the hold window: active side only, one owner per flight. Collection
  goes through `collectFlightParts`, i.e. the `data-flemo-router` marker — DOM ancestry
  cannot draw this boundary (each screen sits in its own wrapper, a root Router renders
  no container, two Routers may share a parent), so a container-scoped walk reaches only
  the screen's own subtree where everything is already held. Stamp is status-scoped
  (never pause a part this flight does not drive — `animation-play-state` is
  per-element and would catch consumer-authored animations too); the release sweep is
  status-agnostic, so a pause can never outlive the flight on persistent chrome.
- **Atomic release flip**: on non-Blink, for authored `driver:"native"` pins and for the
  governed-compiled touch-WebKit tier, the release callback writes
  `data-flemo-anim-hold="false"` directly on the DOM inside the readiness rAF (rAF →
  same-frame rendering update is atomic, so no task can stretch the gap between the
  compiled clock's anchor and first paint), and clears the park-under zIndex in the same
  frame. Sessions outside those populations keep the state-only path (see the profile's
  `atomicReleaseFlip`).

### Release → flight

- The engine effect re-runs with `animHoldReleased: true` and the compiled animation
  starts. `resolveFlightRouting()` has already decided which head covers its opening
  and whether the clock may be touched.
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
  - **beginFlightWindow** — global latch for out-of-engine machinery (the image decode
    offloader defers reveals to the same rest).
  - A navigation owns its participants: any running swipe-settle animation is concluded
    before the flight drives, since it would outrank the compiled rules (the "settle
    race" bug, real-device).
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
  mid-flight screen — see `governedSlide` and `forceCompiled` in `flightRouting.ts`).
  Any unanalyzable participant vetoes.
- **Early landing**: the arrival hold's release fires when every participant is within
  one _CSS_ pixel / alpha step (dpr=1 band — at or before the cut), so the reveal
  commit's layout/paint hides under the playing sub-pixel tail instead of stacking on
  the convergence. Same disarm rules as the cut, plus a stand-down on the steady-60
  desktop profile (`steadySixtyDesktopProfile()`).
- **Landing governor** (`landingGovernor.ts`): a decelerating tail that can no longer
  sustain one device pixel per frame inside the last ~12 device px has its compiled
  EASING reshaped to close the remainder at exactly that velocity — monotone, no
  park-then-tick. Touch Blink at a genuine high-refresh cadence only.

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
    engine's own teardown instead (its COMPLETED effect never runs — Activity freezes it
    in the same commit).
- The arrival/response/image/flight-window holds release together via
  `scheduleLanding` — two rAFs past COMPLETED (or immediately on interrupt; a
  navigation starting inside the pending window calls `landNow()` first).
- **layerSettleHold**: participants' pinned compositor promotions demote off-cadence,
  `LAYER_SETTLE_MS` past the flip and only once the flight window is idle — the demote
  repaint was the full-viewport flash landing exactly on the convergence frames.

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
  form** (flight-over final authority: the COMPLETED flip). With no
  explicit property list, the force form releases every leased property, or — on an
  element with an _empty_ lease map — falls back to stripping `transform`/`opacity`.
- Writers exist because two drivers legitimately co-write one element (a swipe settle
  and the engine on a shared bar); a single-owner lease let whichever finished first
  snap the element out from under the other. The inline `transition` property has
  its own single-value writer tag (`transitionWriters`).

**The lease-restore hazard (PR #259).** The binding renders the entering screen's
from-pose as an _inline style_ (`enteringInitialStyle` — `transform:
translate3d(100%,0,0)` on a cupertino push). Anything that then leases `transform`
captures that flemo-authored from-pose as the "original", so its restore at COMPLETED
re-applies it; the force clear that follows iterates only keys _still in the lease map_
(the restore just dropped the transform entry), and its empty-map fallback never runs
while any other lease survives the flip. The observed result was a landed screen
resting at `translateX(100%)` — a blank viewport — with some sessions saved only by
accident (empty lease map at the flip → fallback strip). The fix: the active COMPLETED
branch strips the scope's pose channels explicitly after the force clear,
`clearInlineAnimation(scope, ["transform", "opacity"])`.

The driver whose track detach exposed this is gone, but the hazard is not: any future
writer that leases a pose channel meets the same trap.
General rule this encodes: **an "original" captured from a flemo-rendered inline style
is not a consumer value; the landed scope belongs to the compiled rest rules.**

## 4. Module inventory

`packages/core/src/core/engine/` — the flight itself:

| Module                      | One line                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createTransitionEngine.ts` | The conductor: per-screen lifecycle drive, holds arming, the resolution paths, COMPLETED cleanup.                                                                                                                                                                                                                            |
| `flightRouting.ts`          | Per-flight decision: which opening treatment, and may the engine touch the clock (section 1).                                                                                                                                                                                                                                |
| `flightParticipants.ts`     | Who is in this flight — a screen's parts vs a nested screen's, this Router's vs another's. Scoping is by the `data-flemo-router` marker, never by DOM ancestry.                                                                                                                                                              |
| `barPartStaging.ts`         | The covered screen's matched shared-bar `<Part>` elements, lifted into the Router's part layer for the flight and returned on landing. Two screens sharing a bar id each render their own copy inside their own isolated container, so one side's cross-fade runs under the other's opaque surface where nothing can see it. |
| `riderSwipe.ts`             | What rides a flight, moved by the finger. A drag flips no status, so the compiled rules never match and a `<Part>` or a dim that declared only a pose sat still while the screens moved. The gesture stages their animations itself and scrubs them, the morph's model, and an authored `onSwipe*` still overrides it.       |
| `participantLayers.ts`      | The compositor-layer lease held for the flight, released off-cadence after it; the landing governor's inline easing rides the same lease.                                                                                                                                                                                    |
| `layerRiders.ts`            | What rides beside a scope: a riding shared bar, and a `<Layer>` overlay. Both need identical treatment from all three drivers and differ only in where they are — a bar never leaves its container, an overlay does, so an overlay names its owner instead.                                                                  |
| `flightHolds.ts`            | Every hold one screen owns across drive runs: the in-flight arrival armor and the warm side's image-only hold.                                                                                                                                                                                                               |
| `cancelResume.ts`           | Re-joins a browser-cancelled compiled animation to its own timeline with a negative inline delay, up to `RESUME_BUDGET`.                                                                                                                                                                                                     |
| `arrivalHold.ts`            | In-flight commit hold: mid-flight swaps/additions held off-glass and reflected in one commit at rest.                                                                                                                                                                                                                        |
| `responseHold.ts`           | Flight-scoped fetch-resolution park (every method, minus streams), delivered in one batch at rest.                                                                                                                                                                                                                           |
| `invisibleAnimationHold.ts` | Pauses invisible consumer animations for the flight (the culled-subtree first-composite stall).                                                                                                                                                                                                                              |
| `imageDecodeHygiene.ts`     | Stamps `decoding="async"` on participants' images, respecting authored attributes.                                                                                                                                                                                                                                           |
| `imageDecodeOffloader.ts`   | Off-main decode-to-scale for oversized images; auto-gated to legacy Android Blink.                                                                                                                                                                                                                                           |
| `flightWindow.ts`           | Global nestable "a flight is in progress" latch for out-of-engine modules.                                                                                                                                                                                                                                                   |
| `layerSettleHold.ts`        | Inline-pinned compositor promotions and their deferred demotion past the flip.                                                                                                                                                                                                                                               |
| `landingGovernor.ts`        | Reshapes the compiled easing so the convergence tail never falls under one device pixel per frame. Its removed sibling — the integer-pixel SNAP — is documented there as falsified; do not re-derive it.                                                                                                                     |
| `perceptualSpan.ts`         | The imperceptibility-band math shared by the completion cut and the early landing.                                                                                                                                                                                                                                           |
| `nativeStallAnchor.ts`      | Clock surgery for main-thread-presenting engines. Authored `driver: "native"` pins only.                                                                                                                                                                                                                                     |
| `gpuPipelinePrewarm.ts`     | One-shot boot-idle probes compiling Chrome Graphite's GPU pipelines before the first flight.                                                                                                                                                                                                                                 |
| `emulationNotice.ts`        | Once-per-session warning when a transition runs under DevTools device emulation (a scaled surface fabricates shimmer).                                                                                                                                                                                                       |
| `createSwipeController.ts`  | Framework-neutral swipe-back: drag-follow inline writes, the release settle clock, bar mirroring, tap slop. Its header carries the Low Power Mode DO-NOT-RETRY list.                                                                                                                                                         |
| `types.ts`                  | The injected engine interface (`TransitionEngineDeps`).                                                                                                                                                                                                                                                                      |

`packages/core/src/platform/` — what kind of browser this is:

| Module                  | One line                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `profile.ts`            | `resolvePlatformProfile()`: every per-browser decision as one object of named fields.                                                    |
| `engineProbes.ts`       | Pure `navigator` reads (Blink, legacy Android Blink, desktop macOS WebKit, desktop Blink). Its header records the retired driver policy. |
| `governedCompiled.ts`   | Whether this session takes the governed compiled treatment (touch WebKit).                                                               |
| `displayCadence.ts`     | The session's learned frame interval, fed by the in-flight probe.                                                                        |
| `displayProbe.ts`       | That probe, plus the frame-pacing keepalive — rAF run during flights, once to measure and once merely to exist.                          |
| `steadySixtyCadence.ts` | The steady-60 desktop verdict, derived from the same samples. Selects defaults, never a driver.                                          |

`packages/core/src/runtime/` — what the app sits in, between navigations:

| Module            | One line                                                                                                                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `flemoRuntime.ts` | `startFlemoRuntime()`: the ambient machinery an app holds so the FIRST navigation is not the one that pays — GPU pipelines compiled at boot idle, oversized image decodes off the main thread where the profile asks, and the compositor kept awake while the user is interacting. Refcounted; a binding starts it per Router mount. |

`packages/core/src/dom/` — the contract between the packages:

| Module          | One line                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `attributes.ts` | Every `data-flemo-*` name and the animation hold's value vocabulary. Enforced from both ends: core fails on a raw literal, the binding fails on an undeclared attribute.                                                                                                                                                                                                                                                                                                                         |
| `holdMirror.ts` | Puts a staging layer back under the hold its screens are under, so what the layer carries starts on the same frame as the flight around it. The strongest hold wins while any source is still held, and a source that has LEFT the document reads as released: an unmounted screen can never flip its own attribute again, and the mirror used to hold the layer for ever on the value that screen left wearing. Shared by the morph layer and the part layer, which had that defect separately. |
| `stacking.ts`   | The paint order one screen keeps inside its own box: content under its chrome, chrome under a `<Layer>` overlay that exists to cover it, and the dim over all three. Was tree order alone, which could not be stated or asserted and made paint a function of JSX position.                                                                                                                                                                                                                      |
| `staging.ts`    | What moving an element into a staging layer needs: the layer's own coordinates (a bezel or preview scales the box), and carrying CSS animation clocks across the re-parent that would otherwise restart them. Shared by the morph flight layer and the part layer, and it lives here because `@morph` already imports `@core/engine` — an engine-driven staging runtime cannot reach back into `@morph` without closing a cycle.                                                                 |

Campaign modules outside those directories:

| Module                                          | One line                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `screen/animStartAnchor.ts`                     | The anim-hold decision (`animHoldKey`) and release scheduling — decode readiness, the render-settle gate, the pop pair coordinator.                                                                                                                                                                           |
| `screen/pendingNetwork.ts`                      | In-flight request accounting, so the settle gate can tell "still loading" from "already complete".                                                                                                                                                                                                            |
| `screen/partLayer.ts`                           | The per-Router box a matched shared bar's parts are staged in, published by the binding for the reason the morph flight layer is: only a Router knows which box bounds its screens. Deliberately not the morph layer — a morph owns the box it stages in and strips the mirrored hold on landing.             |
| `transition/gestureScrub.ts`                    | The drag clock every gesture-driven flight shares: the travel-to-time inversion, and the release rate with the rules learned on glass (the finished-animation rewind, the preserved `currentTime`, the reverse finish that fires no `animationend`).                                                          |
| `transition/partTransition/resolvePartClock.ts` | A part's variant table with its clock filled in from the screen's same variant key, the rule `resolveDecoratorClock` already applies to a dim. A part declares a pose; how long the hand-over takes is the flight's answer.                                                                                   |
| `transition/variantMotion.ts`                   | The variant → `{from, to, duration, delay, ease}` resolver: one source for "where does each variant start".                                                                                                                                                                                                   |
| `transition/animateInline.ts`                   | The inline lease model (section 3) and the imperative swipe write path.                                                                                                                                                                                                                                       |
| `transition/compileTransitionStyles.ts`         | The keyframes compiler: variant rules, `will-change`/`contain` scoping, hold/park rules, the flat-head keyframes behind each head's gate attribute, translate3d-only transforms. Timing is LITERAL by contract — `calc(var())` in animation timing demotes WebKit fades to the main thread (device-bisected). |
| `transition/enteringInitialStyle.ts`            | The entering screen's inline from-pose for its first styled frame (see the lease hazard in section 3).                                                                                                                                                                                                        |

## 5. Removed, and not to be re-derived

Machinery this engine used to carry, with the finding that ended it. Each was
device-verified when it landed; each was device-falsified later. The point of
the list is that "it solved a real measured problem" is not by itself a reason
to bring one back — all of these did.

| removed                                   | why it went                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The rAF motion **player** (2026-08)       | The routing sent every supported browser to the compiled tier before the player was ever consulted, so it drove nothing but desktop Firefox. Its measured costs are recorded where they were paid — the 120Hz partial-present trace in `platform/engineProbes.ts`, the 30Hz Low Power Mode ceiling in `createSwipeController.ts`. |
| The integer-device-pixel **landing snap** | A live A/B on real content judged texel-rigid stepping WORSE than the authored fractional glide — the same verdict as the transformPart 2D-vs-3D experiment, where translate3d was chosen precisely FOR filtered sub-pixel compositing. See `landingGovernor.ts`.                                                                 |
| Governed-tier **front-softening**         | Prescribed against a broken pipeline (var-timing demotion plus the opening skips). With those cured, the softened curve became the "different transition" the user could feel against the authored curve. Check the pipeline underneath before reaching for a curve change.                                                       |

## 6. Who resolves a flight — "never a double resolution"

A flight's navigation task (`TaskManager`) is resolved by exactly ONE live path; every
other path is a backstop that is a no-op once the task settled (`resolveTask` ignores
non-current ids, and every resolver captures `flooredTaskId` at arm time so a stale
resolver can never cut a NEWER flight).

1. **`animationend`** — the always-wired resolver, attached from the first transitional
   render. It also accepts each head tier's suffixed keyframe name
   (`matchesFlightAnimationName`) — a miss there does not just skip a resolve, it
   strands the flight until the watchdog replays it. While the hold pauses the animation
   it cannot fire.
2. **Perceptual cut** — a clean completion: detaches `animationend`, then
   `resolvePresented`. Stood down on the governed touch tiers, where presentation does
   not track the wall clock.
3. **Cancel-resume terminal / watchdog** — WebKit silently cancels compositor
   animations on layer churn (`animationcancel`, never `animationend`);
   `wireCancelResume` re-joins the original timeline up to `RESUME_BUDGET = 4` times
   (budget per task id, not per effect run), and the watchdog replays once from `from`
   if NO signal arrived, then resolves. Recovery events disarm the cut and early
   landing (presentation has shifted off the wall clock).
4. **Liveness floor** — `max(motionSpan, participantSpan) + 1500ms` timeout resolving
   the captured task id: the guarantee that a rapid storm orphaning the element can
   never deadlock the serial task queue.
5. **Task gate backstop** (`TaskManager.anchorGate` / `markGateHeld`) — the last resort;
   re-arms while the hold is on so a long entering-commit block can't fire it into a
   transition-less cut, and is anchored with the choreography's own span so long
   authored motions are never truncated.

Why the invariant is hard: task resolution targets the _live queue_ — a duplicate
resolution's deferred chain (2-rAF landing clear + choreography timer) lands frames
later, where it hits the NEXT task and cuts that navigation (device-measured: a fast
back's pop flipping COMPLETED at ~90ms with zero motion, R19-v3 of the campaign).
When you add any completion path, it must either capture-and-resolve its own task id or
be provably suppressed while another path is live.
