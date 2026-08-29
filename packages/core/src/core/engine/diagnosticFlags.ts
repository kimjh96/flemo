import { detectBlinkEngine, isDesktopMacWebKit } from "@platform/engineProbes";
import { governedCompiledActive } from "@platform/governedCompiled";
import { steadySixtyDesktopProfile } from "@platform/steadySixtyCadence";

// The `flemo:*` flag READERS. What each key is and what it defaults to is
// declared as data next door, in `diagnosticRegistry.ts` — and pinned against
// these readers by `__tests__/diagnosticRegistry.test.ts` (every key read here
// is declared) and `__tests__/documentedDefaults.test.ts` (every documented
// default matches the reader that computes it).
//
// Caching contract: the URL-armed toggles (`flemo:layers`, `flemo:freeze`) are
// read ONCE per page load and cached — they select a code path for a whole
// session. Every other reader here is uncached: read per decision, so a
// DevTools toggle takes effect on the next navigation without a reload.
//
// Every reader degrades to its default on storage failure. A partitioned or
// sandboxed document throws on sessionStorage ACCESS, and a diagnostic toggle
// must never take a transition down with it.

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

// `flemo:morph=on` — trace the morph runtime's decisions.
//
// A flight that does not happen is SILENT by design: a morph with no partner,
// no measurable box or no layer simply declines, because a shared element is
// an enhancement and a broken one must never take the navigation with it. The
// cost of that is that a miss looks exactly like a screen transition without
// a morph in it — which is what a consumer reports, once, with no way to ask
// for it again. Armed, every decision says which one it was.
export const morphTraceArmed = (): boolean => readStorageValue("flemo:morph") === "on";

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

// `flemo:parkhead` — whether the governed head carries the PARK pose (see
// PARK_HEAD_ATTR) or the authored off-screen from-pose. Default ON, and only
// ever consulted where the park-over hold was granted in the first place, so
// this key decides one thing: whether the raster that hold paid for survives
// the delay-plus-head wait between the release and the first moving frame.
//
// `off` is the A/B, and it is the whole reason the key exists — the difference
// is invisible on a screen shorter than one tile row and unmistakable on a long
// one, which makes it a judgement a device has to make, in both directions.
export const readParkHeadFlag = (): boolean => readStorageValue("flemo:parkhead") !== "off";

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

// `flemo:governed` — the GOVERNED HEAD KIT on touch Blink: "on" arms it for any
// touch Blink session, "off" opts a legacy one out, anything else defers to the
// browser-age auto-detection (isLegacyAndroidBlink).
//
// It exists because that auto-detection selects a browser, not a device. A
// modern-but-weak touch Blink used to earn the kit through the driver demotion
// machinery, which is gone — and a 2022 foldable on a current Chrome is exactly
// the population that falls through. There is no way to try the kit on such a
// device without this key, and extending it to ALL touch Blink is the lever
// that was reverted on 2026-08-14 when fast devices picked up the compiled
// landing snap. Measure per device first.
export const readBlinkGovernedOverride = (): "on" | "off" | null => {
  const value = readStorageValue("flemo:governed");
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
