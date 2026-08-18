# @flemo/react · architecture for agents

The React binding over `@flemo/core`. The split is strict: core owns everything
imperative and reusable (task queue, stores, engine, compiled styles, gesture math);
this package owns React wiring — rendering the declarative state (data-attributes,
inline styles) core's engine reads, and calling core at the right lifecycle moments.
Engine internals are documented in `docs/architecture/motion-engine.md` and
`docs/architecture/driver-routing.md`; diagnostics in `docs/diagnostics.md`. Public
surface = `src/index.ts` re-exports only.

## Router (`src/Router.tsx`)

- **Store creation**: one `FlemoStores` bundle per Router via core's
  `createRouterScope` (seeded in a `useState` initializer so zustand hands it to React
  as the SSR snapshot). A `<RouterScopeProvider>` above a root Router can host the
  bundle (inspector access); nested Routers always own a local one.
- **History driver**: `history="browser"` (default, even nested) drives
  `window.history` through a keyed `HistoryDriver` (`createDriver` prop overrides —
  e.g. a locale wrapper); `history="memory"` runs an isolated stack. A NESTED browser
  Router derives its key from parent key + enclosing screen's entry id (re-entry
  stable, unlike useId) and persists its scope across destroy/re-create so browser
  Back into its zone resumes the same stack. `seedRouterEntry` stamps the mount entry;
  `HistoryListener` is the thin popstate→navigation bridge (logic in core's
  `ensureScopeHistorySync`).
- **Hydration**: `data-flemo-router` (the flight-boundary marker the engine scopes
  `<Part>` collection by) is `useId`-based but withheld until after hydration —
  useId encodes position from the hydration root, so mismatched server/client roots
  would surface as a hydration mismatch on the one flemo attribute that reaches DOM.
- **Liveness**: `stores.life.alive` flips in a LAYOUT effect (a passive effect flushes
  after the reveal paints; a traversal task in that window would see a visible zone as
  dead and skip its transition).
- **Prewarm/offloader effects**: `ensureGpuPipelinePrewarm` (one-shot boot),
  interaction-scoped `holdCompositorWarm` (renewed ≤2/s while the user interacts, 3s
  tail), and `ensureImageDecodeOffloader` — auto only on `isLegacyAndroidBlink()`,
  overridden by `flemo:imgoffload` (`readImageOffloadOverride`).
- **Slot**: `findSlotRoutes` walks the static JSX for a `<Slot>`; with one, `children`
  is persistent chrome and the Slot renders the stack; without, children are routes.

## ScreenMotion (`src/screen/ScreenMotion.tsx`) — the binding god-file

Its jobs, in order of appearance:

1. **Engine instantiation**: one `createTransitionEngine` per screen (ref-lazy), fed
   the minimal deps (task id getter + two store setters). `driveScreenLifecycle` runs
   in `useLayoutEffect` on `[status, isActive, transitionName, prevTransitionName,
animHold]` — the anim-hold release re-runs it, which is how motion hands to the
   player.
2. **Status subscription pinning**: only the top screen and the one beneath
   (`participatesInTransition`) subscribe to live status; resting screens pin to
   "COMPLETED" so a navigation is O(1) re-renders, not O(depth).
3. **Holds**: `holdKey = animHoldKey(...)` computed in RENDER; hold state flips via a
   render-phase `setAnimRelease` adjustment so hold + status attributes land in one
   commit (Activity-unfrozen screens included). `holdAttr` picks
   `true / park / park-under / park-over(diagnostic)` — park variants gated on the
   partner screen's registered opaque surface; park-under also sinks the OUTER
   container (`zIndex: -1`). The release goes through the per-scope
   `AnimHoldCoordinator` (pop pair barrier; module WeakMap keyed by the navigate
   store) with `decodeWait` only for screens waking from a freeze, and the
   render-settle gate (`contentSettle`, `readSettleGateFlag()` — default on for touch
   WebKit, all engines eligible; firstWait 120 / cap 700 / grace 60,
   `renderSettleOnly`). **Atomic release flip**: for authored `driver:"native"` and
   the governed-compiled touch-WebKit tier, the release callback writes
   `data-flemo-anim-hold="false"` directly on scope/bars/decorator inside the
   readiness rAF (and clears the park-under zIndex) — player-routed flights keep the
   state-only path.
4. **Swipe wiring**: a stable `createSwipeController` (core) reads live render values
   through `swipeEnvRef` (latest-ref pattern); pointer handlers forward native events;
   an active `touchmove` listener prevents native scroll only after the controller has
   claimed a drag. Recognition waits for 8px of movement and requires a 3:1 primary-
   axis lead, so vertical scroll jitter cannot become page-wide horizontal back; a
   `pointercancel` always settles without navigation. The 8px edge-zone strips are
   pointer-transparent layout markers. PUSHING/REPLACING destinations remain hit-
   testable so a touch begun during the flight can scroll after landing, while an
   outer capture handler suppresses click activation until the transition completes.
5. **Bar riding and identity**: `computeBarRiding` in RENDER sets
   `data-flemo-bar-riding` in the same commit as the bar's status attribute (the
   compiled sibling selector keys on both); swipe mirrors bars synchronously inside
   the controller instead. Bars hand over only when position and optional ID match:
   two unlabelled bars retain the legacy match, while a labelled bar never aliases an
   unlabelled or differently labelled bar. DOM fallback IDs carry
   `data-flemo-bar-id-type`, so numeric `3` remains distinct from string `"3"` when a
   frozen partner has not reconnected its registry yet.
6. **Entering-initial style AND its lease hazard**: `enteringInitialStyle` renders the
   active entering screen's from-pose as an _inline style_ for the first styled frame
   (withheld while parked — it would defeat the park rule). Because it is inline and
   flemo-authored, any engine lease over `transform`/`opacity` captures it as the
   "original" — the root cause of the desktop player blank (PR #259; the engine now
   strips the scope's pose channels at COMPLETED). If you add inline styles here,
   assume the engine may capture and restore them.
7. **Chrome**: status/system bars, shared top/bottom bars, the decorator,
   `data-swipe-at-edge-bar` strips, and the surface registry
   (`registerScreenSurface`, computed-style opacity, re-measured per status flip).
   Shared-bar spacing has a pre-paint ordering contract: the ref callback measures
   first and writes both the spacer and a measurement ref; the registration layout
   effect publishes identity + that height in one store notification; then
   `observeBarHeight` performs an idempotent initial report and keeps dynamic resizes
   current. A matching partner's registered height seeds the destination spacer in
   render, before its own bar measures. Same-ID re-registration preserves the cached
   height; changing ID discards it.

## Screen / freeze

- `Screen.tsx` composes `ScreenFreeze` + `ScreenMotion` and computes freeze via core's
  `computeScreenFreeze(Mode)`. `ScreenFreeze` is React `<Activity>`: hidden mode keeps
  DOM/scroll/state alive but unmounts effects — which is why a covered prev screen's
  COMPLETED effect never runs (player tracks clean up in their detach instead) and why
  mount effects re-fire on every unfreeze (`eagerlyDecodeImages` uses exactly that).
  `flemo:freeze=shallow` (URL-armable) keeps the direct prev screen live.
- Activity hiding disconnects `ScreenMotion` layout effects, so shared-bar cleanup
  unregisters the entry. State and measurement refs survive; the unfreeze registration
  republishes the complete ID + height before the observer reconnects. Do not move the
  measurement solely into an effect or reintroduce an identity-only registry window.

## Renderer / Part / decorator / hooks

- `Renderer.tsx`: matches `histories` against `<Route>` declarations
  (`matchesPathname`/`getMatchedPathPattern`), renders the stack with
  `ScreenContext` + `ParamsProvider` per entry.
- `Part.tsx`: wraps an element in a named part-transition; self-carries its screen's
  status/active attributes (and the Router marker via ScreenContext/RouterIdContext)
  so compiled selectors and the engine's variant queries scope correctly.
- `ScreenDecorator.tsx`: the dim/decorator element (`decoratorMap` lookup), driven by
  the same holds/engine joins.
- Hooks: `useNavigate`/`usePathname`/`useStep` (navigation), `useScreen` (identity/
  role), `useParams`, store hooks (`useHistoryStore` etc. — zustand selectors over the
  scope bundle), `useViewportScrollHeight` (keyboard detection; hides bottom chrome).
- `scopeAnimHoldCoordinator.ts`: per-scope coordinator singleton (WeakMap by navigate
  store) — nested Routers can never share a pop pair-release group.

## Rules of thumb

- Path aliases: `@history`, `@navigate`, `@renderer`, `@screen`, `@transition`,
  `@utils`, `@Route`, `@Router`; import core as `@flemo/core` named imports only.
- Anything the engine must see in the FIRST paint of a state change is computed in
  RENDER, never an effect (hold attrs, riding flags, freeze tracking refs).
- Tests live in `__tests__/` beside the source; jsdom runs the player tier by default
  (empty platform, no touch) — see the worked-examples row in driver-routing.md.
