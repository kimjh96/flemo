import { detectBlinkEngine, isDesktopMacWebKit } from "@core/engine/engineProbes";
import { governedCompiledActive } from "@core/engine/governedCompiled";
import { steadySixtyDesktopProfile } from "@core/engine/steadySixtyCadence";

// ─────────────────────────────────────────────────────────────────────────────
// The `flemo:*` diagnostic-flag registry.
//
// Every storage-backed flag the library reads lives (or is documented) here —
// one module, one table, instead of readers scattered across the engine. The
// flags fall into three classes:
//
// - production-state: written by the library itself (learned ledgers). Never
//   set these by hand; their KEY STRINGS are frozen — users' devices carry
//   persisted values.
// - production-default-with-override: the library computes a default; the key
//   overrides it both ways for field debugging.
// - opt-in diagnostic: default OFF; a measurement instrument that ships so a
//   device session can be probed without a custom build.
//
// | key                       | storage | values                          | default                    | class                            | effect                                                                 |
// |---------------------------|---------|---------------------------------|----------------------------|----------------------------------|------------------------------------------------------------------------|
// | flemo:sixty               | session | "high" / streak count           | (learned)                  | production-state                 | steady-60 desktop verdict seed — owned by steadySixtyCadence.ts        |
// | flemo:imghold             | session | "on"                            | off                        | opt-in diagnostic                | flight-scoped <img> reveal hold (imageRevealHold.ts)                   |
// | flemo:arrivalhold         | session | "off"                           | on                         | production-default-with-override | arrival hold (freeze-and-replay of in-flight arrivals) — arrivalHold.ts |
// | flemo:settle-gate         | session | "on"/"off"                      | touch WebKit + touch Blink + desktop macOS WebKit + steady-60 desktop | production-default-with-override | render-settle entry gate (engine routing + react ScreenMotion) |
// | flemo:layers              | session | "resident"/"off"                | off                        | opt-in diagnostic                | resident screen layers at rest (layerSettleHold.ts) — a resident layer is a permanent stacking context over the consumer screen |
// | flemo:freeze              | session | "shallow"                       | off                        | opt-in diagnostic                | keep the direct prev screen live (computeScreenFreeze.ts)               |
// | flemo:deskflip            | session | "on"/"off"                      | desktop macOS WebKit       | production-default-with-override | atomic release flip on desktop Safari (react ScreenMotion's directFlip)  |
// | flemo:deskhead            | session | "on"/"off"                      | desktop macOS WebKit       | production-default-with-override | desktop flat-head keyframes (`data-flemo-desk-head`, DESKTOP_HEAD_MS); arming it retires the desktop birth anchor |
// | flemo:creep               | session | "on"/"off"                      | touch WebKit               | production-default-with-override | creep head: the head's end keyframe carries a hair of motion so the compositor is already carrying the animation at the boundary |
// | flemo:relcommit           | session | "defer"/"sync"                  | touch WebKit               | production-default-with-override | release's React reconcile lands next frame instead of flushSync (react ScreenMotion) |
// | flemo:preraster           | session | "on"                            | off                        | opt-in diagnostic                | REST-time scope promotion (readRestLayerPromotionFlag, react ScreenMotion, after hydration); also selects the park-over hold variant. Flight-time promotion is the engine's stamp and needs no flag |
// | flemo:imgoffload          | session | "on"/"off"                      | auto (legacy Android Blink)| production-default-with-override | image decode offloader override (react Router)                         |
//
// THIS TABLE IS TESTED. `__tests__/documentedDefaults.test.ts` asserts every
// computable default above against the reader that implements it, because the
// table drifted from the code four keys at a time (2026-08-17 → 08-19) while
// `docs/diagnostics.md` was pointing readers here as the source of truth. If
// you change a default, the test fails until the row matches.
//
// RETIRED with the rAF player (2026-08-22), and NOT to be reintroduced without
// a driver to serve: `flemo:motion-driver` (the per-origin demotion ledger),
// `flemo:motion-driver-force` (the hard driver pin), `flemo:landing-snap`
// (integer-device-pixel tail A/B — falsified on device, see
// landingGovernor.ts), `flemo:handoff` / `flemo:handoffms` (the player's
// anchored-opening handoff), `flemo:apply` (scrub-WAAPI application tier),
// `flemo:snap` / `flemo:snapband` (the player's device-pixel snap policy).
// Values persisted on users' devices are never read again.
//
// Caching contract: the URL-armed toggles (`flemo:layers`, `flemo:freeze`) are
// read ONCE per page load and cached — they select a code path for a whole
// session. Every other reader here is uncached — read per decision, so a
// DevTools toggle takes effect on the next navigation without a reload.
//
// Every reader degrades to its default on storage failure: a partitioned or
// sandboxed document throws on sessionStorage ACCESS, and a diagnostic toggle
// must never take a transition down with it.
// ─────────────────────────────────────────────────────────────────────────────

// Guarded raw read: null when the key is unset, storage is absent, or storage
// access throws.
const readStorageValue = (key: string): string | null => {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

// ── Uncached engine-routing flags (read per decision) ───────────────────────

// `flemo:imghold=on` — the <img> analog of responseHold: park an entering
// screen's still-loading image paints to rest (imageRevealHold.ts). OPT-IN on
// every engine — see the call-site comment in createTransitionEngine.
export const readImageHoldFlag = (): "on" | "off" | null => {
  const value = readStorageValue("flemo:imghold");
  return value === "on" || value === "off" ? value : null;
};

// A touch Blink session — the phone class the gate was actually validated on.
// See the default below: this is NOT a weak-device predicate. The evidence is
// about the phenomenon (a heavy mount commit stalling even the compositor's
// initial layerization), which does not care whether the device already earned
// a demotion.
// No navigator guard: detectBlinkEngine() returns false without one, so the
// short circuit already covers it.
const isTouchBlink = (): boolean => detectBlinkEngine() && (navigator.maxTouchPoints ?? 0) > 0;

// `flemo:settle-gate` — the render-settle entry gate. ON BY DEFAULT for touch
// WebKit (governedCompiledActive — the governed-compiled tier ships with it),
// for steady-60 desktop Blink sessions, for touch Blink, AND for desktop macOS
// Safari.
//
// The steady-60 desktop term is a PROFILE, not a driver claim. It was written
// when a verified steady-60 session routed to the player, whose main-thread
// per-frame write the entering mount commit would stall; that routing is gone
// (Blink runs compiled everywhere since 2026-08-19) but the default stays,
// because the reason that survives is the tier-independent one: the measured
// ~50ms desktop mount hitch ages a wall-clocked compiled animation just as it
// starved the player. See steadySixtyDesktopProfile's own note — the name is
// historical.
//
// Touch Blink was the gap: the pop-convergence round (de35c13) widened the
// ARMING to "ALL engines" and wrote the reason into ScreenMotion — "it was
// thought WebKit-only … but device A/B on a demoted Note 9 falsified that:
// its heavy detail mount runs a ~290ms main-thread task that stalls even the
// compositor's initial commit/layerization, so gating the release to AFTER
// that task measurably helped". The DEFAULT never followed that finding, so
// every Android session kept running ungated while the code documented the
// opposite. Re-confirmed on the same device class 2026-08-19.
//
// DESKTOP macOS Safari (isDesktopMacWebKit) was the same gap one platform
// over, and the LAST session routed to a wall-clocked animation with nothing
// holding it. It runs the compiled tier on purpose
// (macOS Safari caps rAF at 60Hz, so the player can only paint half a
// ProMotion panel's frames) — but WebKit presents those compiled animations
// from the MAIN THREAD, so a heavy entering mount
// eats the opening exactly as it does on a phone. Frame-level measurement of
// the docs site's own Home -> Showcase push (2026-08-20, production build,
// WebKit): the entering screen's mount blocked the main thread for 103-135ms
// while the animation's clock ran, so the FIRST presented frame already stood
// at 48-77% progress; the release commit then re-anchored the animation and it
// replayed from zero — a jump followed by a rewind, both visible. The same
// flight on Chromium was clean (max frame gap 17.6ms, monotonic 16 -> 300ms),
// which is why it read as Safari-only. With the gate armed the block is
// unchanged but the flight departs after it and plays 16 -> 300ms monotonic.
// Touch WebKit is already covered above by governedCompiledActive; this term
// is only the non-touch Mac session.
//
// The gate is adaptive, which is why this is safe to widen: with no
// qualifying mount commit inside firstWaitMs it releases with no felt delay,
// so a fast phone pays nothing for carrying it. "off" opts out, "on" forces
// it elsewhere. Shared verbatim by the engine's routing and the react binding's
// ScreenMotion (this is the one reader that was byte-duplicated across
// core/react before the consolidation).
export const readSettleGateFlag = (): boolean => {
  try {
    const value =
      typeof sessionStorage !== "undefined" ? sessionStorage.getItem("flemo:settle-gate") : null;
    if (value === "on") return true;
    if (value === "off") return false;
    return (
      governedCompiledActive() ||
      steadySixtyDesktopProfile() ||
      isTouchBlink() ||
      isDesktopMacWebKit()
    );
  } catch {
    return false;
  }
};

// `flemo:arrivalhold=off` — diagnostic kill-switch for the whole in-flight
// arrival armor (response/arrival/invisible-animation/image holds). Added
// 2026-08-18 for live A/B isolation of the hold machinery itself as a felt-
// jank suspect; default ON (armor engaged) everywhere.
export const readArrivalHoldFlag = (): boolean => readStorageValue("flemo:arrivalhold") !== "off";

// `flemo:deskflip` — the ATOMIC RELEASE FLIP on desktop macOS Safari (react
// ScreenMotion's `directFlip`). The flip writes `data-flemo-anim-hold="false"`
// straight onto the DOM inside the readiness rAF, so a compiled clock's start
// and its first paint are simultaneous by construction; the state-only path
// hands that write to a later React task, and anything slotting into that gap
// is aging the clock before a single frame is presented.
//
// DEFAULT-ON for desktop macOS Safari (isDesktopMacWebKit), which routes
// compiled (isDesktopMacWebKit) and presents from the main thread — the exact
// combination the flip was built for. It reaches production there through this
// reader only: touch WebKit is armed by governedCompiledActive, and an authored
// `driver: "native"` pin arms itself.
//
// Blink is NOT reachable from here. ScreenMotion ANDs `!detectBlinkEngine()`
// over the whole predicate, because the flip's known failure mode is a
// PLAYER-routed flight (the compiled animation starts in the release rAF and
// the player then restarts the motion — the double-start that poisoned the
// 2026-08-18 steady-60 desktop round). Desktop Safari cannot hit that: gate 3
// pins it to the compiled tier for every flight.
//
// The key exists so the change is judgeable on glass in ONE session — `off`
// restores the state-only release, `on` forces the flip on any non-Blink
// session. Uncached, so a DevTools toggle takes effect on the next navigation.
export const readDesktopReleaseFlipFlag = (): boolean => {
  const value = readStorageValue("flemo:deskflip");
  if (value === "on") return true;
  if (value === "off") return false;
  return isDesktopMacWebKit();
};

// `flemo:creep=on` — the CREEP head (compileTransitionStyles). The head's end
// keyframe carries a translateZ hair instead of repeating the start pose, so
// the value changes across the head and the compositor is already carrying the
// animation when the real motion begins. Aimed at the one dropped frame that
// device timelines pinned to the head BOUNDARY (it followed the head length:
// 100ms head → 6th frame after release, 200ms → 12th).
export const readCreepHeadFlag = (): boolean => {
  const value = readStorageValue("flemo:creep");
  if (value === "on") return true;
  if (value === "off") return false;
  return governedCompiledActive();
};

// `flemo:relcommit=defer` — hand the release's React reconcile to the NEXT
// frame instead of `flushSync`ing it into the release frame.
//
// Device timelines (iPhone, 2026-08-20) show TWO dropped frames on a PUSH: one
// at the head boundary (the creep head addresses that) and one AT THE RELEASE
// itself — 11 of 18 stock PUSH flights, and 0 of 17 POPs, which is exactly the
// asymmetry a mount-heavy entering commit predicts. The compiled clock starts
// on the release frame's style change and WebKit presents it from the main
// thread, so React's reconcile of that same update competes with the flight's
// first present.
//
// The `flushSync` this defers exists for a real defect: an unrelated commit
// landing in the flip→reconcile window renders the STALE held state and writes
// the paused hold attribute back over a RUNNING animation. Deferring alone
// would reopen it, so the binding pairs this with a render-phase read of the
// imperative release (see ScreenMotion's releasedKeyRef): once the DOM flip has
// happened, every render — interleaved or not — already renders the released
// state, so the window is closed by construction rather than by timing.
export const readDeferReleaseCommitFlag = (): boolean => {
  const value = readStorageValue("flemo:relcommit");
  if (value === "defer") return true;
  if (value === "sync") return false;
  return governedCompiledActive();
};

// `flemo:deskhead` — the flat-head keyframes on desktop macOS Safari, the
// desktop sibling of the LPM head (`:root[data-flemo-desk-head]`, compiled by
// compileTransitionStyles with DESKTOP_HEAD_MS). A compiled clock is born at the
// release update's style resolution but its first frame reaches the glass only
// after that update's paint, the compositor commit and the UI process's
// activation; the head holds the authored from-pose across that latency so the
// curve PLAYS from 0 instead of being entered partway — the "starts at 60" jump
// on a phone, the "whoosh" on a Mac.
//
// DEFAULT-ON for desktop macOS Safari (isDesktopMacWebKit), which is the only
// desktop session on that clock. Touch WebKit has its own head (data-flemo-governed)
// with its own lengths and is unaffected by this key.
//
// STYLE ONLY, and that is the point: the head is baked into gate-scoped literal
// keyframes, never a WAAPI write on a running animation. The 2026-08
// falsification series implicated every clock surgery on WebKit's accelerated
// path, which is also why arming this head RETIRES the desktop birth anchor for
// the same flight (see createTransitionEngine) — two corrections of one clock
// fight each other.
//
// `off` restores the anchor-only behavior for an A/B. Only on/off is runtime-
// togglable: the head lengths are literal in the compiled sheet (var()/calc()
// timing lost WebKit's accelerated playback, device-bisected 2026-08-13), so
// re-sizing them means editing DESKTOP_HEAD_MS and the compiler's table
// together.
export const readDesktopHeadFlag = (): boolean => {
  const value = readStorageValue("flemo:deskhead");
  if (value === "on") return true;
  if (value === "off") return false;
  return isDesktopMacWebKit();
};

// `flemo:preraster=on` — promote the entering content layer from the hold
// onward (react ScreenMotion). Retained as an opt-in probe; the swallow it
// probed is solved by the scrub tier's freeze-on-block opening.
export const readPrerasterFlag = (): boolean => readStorageValue("flemo:preraster") === "on";

// The screen scope's compositor-layer promotion at REST — the `will-change:
// transform` the react binding puts on `[data-flemo-screen]` when it is the
// top screen of a root Router and nothing is animating. OPT-IN, armed by
// `flemo:preraster=on`.
//
// The FLIGHT-time promotion is not here and never needed a tier predicate: the
// engine stamps every participant inline for the length of the flight
// (holdParticipantLayers → layerSettleHold), on every tier, from the first
// transitional effect — the same commit that renders the hold. The binding
// used to promote the scope on top of that, gated on a tier list, and that
// second promotion was worse than redundant: the engine's stamp captures the
// element's inline `will-change` as the value to RESTORE when it demotes, so
// the binding's own promotion was recorded as if it were the consumer's and
// written back permanently at every landing. The scope then stayed a stacking
// context for the rest of its life (bars at `z-index: 1` above any consumer
// overlay inside the screen — the tab-bar-over-bottom-sheet report), while
// bars and decorator, which the binding never styles, demoted cleanly. Same
// capture trap as the entering-pose lease in PR #259, one property over.
//
// Why the REST half is opt-in: at rest there is no flight to price the
// confinement into, and the screen can sit there for minutes.
//
// SSR CONTRACT: the terms are browser-only state (sessionStorage), so this can
// never be evaluated during a SERVER render or during the client's HYDRATION
// render — the two would disagree and React would report a style mismatch on
// the one flemo element that carries an inline style. A binding must defer it
// past hydration (react: `useHydrationSafeFlag`, whose SSR snapshot is a
// constant `false`).
// The REST half of that promotion — the top screen keeping its layer while
// NOTHING is animating — is a separate decision, and it is OPT-IN.
//
// Every way to promote a layer (`will-change: transform`, a transform, an
// opacity below 1) also makes the element a STACKING CONTEXT and a containing
// block for fixed descendants. During a flight that is priced in: the scope is
// already transformed, so consumer content inside it is already confined, and
// the window closes when the flight lands. AT REST it is not: the scope carries
// the whole consumer screen, and a permanent stacking context on it means no
// consumer overlay rendered inside a screen can ever paint above the shared
// bars — the binding renders those as siblings at `z-index: 1`, so a consumer's
// `position: fixed; z-index: 50` bottom sheet lands UNDER the tab bar no matter
// what z-index it picks. Device-reported (plen, iOS Safari) and reproduced:
// with the rest promotion on, a hit test at the tab bar's centre over an open
// sheet returns the bar; with it off, the sheet.
//
// That is a silent change to what a consumer's own CSS means, which no z-index
// on their side can answer, so it cannot be the default. The measurement motive
// (the next push's leaving side starting with a live backing store instead of
// paying promotion + full-layer raster on its opening frames) is real and the
// lever stays: `flemo:preraster=on` arms it. The bounded version of the same
// idea is still default-on and unaffected — layerSettleHold keeps every
// flight's layers alive for LAYER_SETTLE_MS past the landing, which already
// covers a quick browse rhythm.
export const readRestLayerPromotionFlag = (): boolean => readPrerasterFlag();

// `flemo:imgoffload` — image decode offloader override for the react Router:
// "on" forces it on any engine, "off" opts a legacy device back out, anything
// else defers to the caller's auto-detection (isLegacyAndroidBlink).
export const readImageOffloadOverride = (): "on" | "off" | null => {
  const value = readStorageValue("flemo:imgoffload");
  return value === "on" || value === "off" ? value : null;
};

// ── Cached URL-armed toggles (layers / freeze) ──────────────────────────────
// The `flemo:layers` / `flemo:freeze` keys are set directly; their readers stay in the owning
// modules (they just write these storage keys at module load, before the
// first read caches).

// `flemo:layers=resident` — keep SCREEN layers resident at rest instead of
// demoting them LAYER_SETTLE_MS past the flip (see layerSettleHold.ts).
let residentLayersCache: boolean | undefined;
export const residentScreenLayers = (): boolean => {
  if (residentLayersCache !== undefined) return residentLayersCache;
  const value = readStorageValue("flemo:layers");
  // OPT-IN. It was DEFAULT-ON for touch WebKit for one day (2026-08-20/21
  // device round on a real iPhone): the compiled variant rule's `will-change`
  // unmatches at the COMPLETED flip, and that demotion repaints the whole
  // element into its parent on the exact frames the eye is watching settle —
  // layerSettleHold's own notes call it the dominant main-thread item of the
  // convergence tremor. Keeping the layer resident removes the repaint
  // outright, and the reported tremor did not recur once it was armed.
  //
  // Reverted 2026-08-21, on the user's call, because of what a RESIDENT layer
  // costs the consumer. `will-change: transform` makes the screen scope a
  // STACKING CONTEXT, and keeping it forever means no overlay a consumer
  // renders inside a screen can ever paint above the shared bars (siblings at
  // `z-index: 1`): device-reported on plen, where an open bottom sheet
  // (`position: fixed; z-index: 50`) came up UNDER the tab bar after any
  // navigation, with no z-index on their side able to answer it. A motion
  // refinement may not silently redefine what consumer CSS means, so the
  // repaint goes back to being deferred (layerSettleHold's LAYER_SETTLE_MS)
  // rather than skipped. `flemo:layers=resident` re-arms the experiment for a
  // session; `off` is still honored so an armed session can be cut short.
  residentLayersCache = value === "resident" ? true : false;
  return residentLayersCache;
};

/* v8 ignore next 3 -- test hook: the toggle is read once per page load. */
export const resetResidentLayersForTesting = () => {
  residentLayersCache = undefined;
};

// `flemo:freeze=shallow` — keep the DIRECT prev screen live (never freeze it);
// deep screens keep freezing (see computeScreenFreeze.ts).
let shallowFreezeCache: boolean | undefined;
export const shallowFreeze = (): boolean => {
  if (shallowFreezeCache !== undefined) return shallowFreezeCache;
  shallowFreezeCache = readStorageValue("flemo:freeze") === "shallow";
  return shallowFreezeCache;
};

/* v8 ignore next 3 -- test hook: the toggle is read once per page load. */
export const resetShallowFreezeForTesting = () => {
  shallowFreezeCache = undefined;
};
