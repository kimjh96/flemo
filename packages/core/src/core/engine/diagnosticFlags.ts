import { detectBlinkEngine } from "@core/engine/driverPolicy";
import { governedCompiledActive } from "@core/engine/lowPowerCadence";
import { steadySixtyPlayerEligible } from "@core/engine/steadySixtyCadence";

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
// | flemo:motion-driver       | local   | learned ledger                  | (learned)                  | production-state                 | player demotion ledger — owned by driverPolicy.ts, not read here       |
// | flemo:motion-driver-force | session | "css@<epoch-ms>"/"raf@<epoch-ms>" | unset                    | opt-in diagnostic                | hard driver pin (24h TTL) — owned by driverPolicy.ts, not read here    |
// | flemo:lpm                 | session | "1"/"0"                         | (learned)                  | production-state                 | low-power cadence seed — owned by lowPowerCadence.ts, not read here    |
// | flemo:lat                 | session | integer ms                      | (learned)                  | production-state                 | LPM release-latency seed — owned by lowPowerCadence.ts, not read here  |
// | flemo:sixty               | session | "high" / streak count           | (learned)                  | production-state                 | steady-60 desktop verdict seed — owned by steadySixtyCadence.ts        |
// | flemo:landing-snap        | session | "on"                            | off                        | opt-in diagnostic                | Blink landing pixel-snap easing A/B (landingPixelSnap.ts)              |
// | flemo:imghold             | session | "on"/"off"                      | unpainted-only on steady-60 desktop, else off | production-default-with-override | flight-scoped <img> reveal hold (imageRevealHold.ts)   |
// | flemo:arrivalhold         | session | "off"                           | on                         | production-default-with-override | arrival hold (freeze-and-replay of in-flight arrivals) — arrivalHold.ts |
// | flemo:settle-gate         | session | "on"/"off"                      | touch WebKit + touch Blink + steady-60 desktop | production-default-with-override | render-settle entry gate (engine routing + react ScreenMotion) |
// | flemo:handoff             | session | "on"                            | off                        | opt-in diagnostic                | anchored-opening handoff, POP-scoped (transitionPlayer.ts)             |
// | flemo:handoffms           | session | number ms                       | 100 (six 60Hz frames)      | opt-in diagnostic                | moves the handoff point per session                                    |
// | flemo:apply               | session | "scrub"                         | off                        | opt-in diagnostic                | force the scrub-WAAPI value-application tier for every track           |
// | flemo:snap                | session | "always"/"off"/"gate"/"hybrid"  | platform policy            | production-default-with-override | player device-pixel snap policy (composeTransform)                     |
// | flemo:snapband            | session | number (device px)              | 4                          | opt-in diagnostic                | "hybrid" snap's jitter-band width                                      |
// | flemo:layers              | session | "resident"                      | off                        | opt-in diagnostic                | resident screen layers at rest; armed by ?flemo-layers= (layerSettleHold.ts) |
// | flemo:freeze              | session | "shallow"                       | off                        | opt-in diagnostic                | keep the direct prev screen live; armed by ?flemo-freeze= (computeScreenFreeze.ts) |
// | flemo:preraster           | session | "on"                            | off (but the rest-promotion half is default-on for steady-60 desktop) | production-default-with-override | promote the entering content layer through the hold; also selects the park-over hold variant (react ScreenMotion) |
// | flemo:imgoffload          | session | "on"/"off"                      | auto (legacy Android Blink)| production-default-with-override | image decode offloader override (react Router)                         |
//
// THIS TABLE IS TESTED. `__tests__/documentedDefaults.test.ts` asserts every
// computable default above against the reader that implements it, because the
// table drifted from the code four keys at a time (2026-08-17 → 08-19) while
// `docs/diagnostics.md` was pointing readers here as the source of truth. If
// you change a default, the test fails until the row matches.
//
// (The one surviving `window.__flemo*` global is `__flemoPlayerGaps` — the
// player's frame-gap mirror in transitionPlayer.ts, read by the e2e suite.)
//
// Caching contract: the transitionPlayer overrides (`flemo:apply`,
// `flemo:snap`, `flemo:handoff` [player side], `flemo:snapband`,
// `flemo:handoffms`) and the URL-armed toggles (`flemo:layers`,
// `flemo:freeze`) are read ONCE per page load and cached — the flags select a
// code path for a whole session, and a hot-path storage read per frame would
// be its own jank source. The engine-routing reads (`flemo:landing-snap`,
// `flemo:imghold`, `flemo:settle-gate`, `flemo:handoff` [engine side],
// `flemo:preraster`, `flemo:imgoffload`) are uncached — read per decision, so
// a DevTools toggle takes effect on the next navigation without a reload.
// Both behaviors are the pre-consolidation semantics, preserved exactly.
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

// `flemo:landing-snap=on` — Blink-only landing pixel-snap easing A/B. A live
// device A/B judged texel-rigid stepping WORSE than the authored fractional
// glide, so this is measurement-only; see landingPixelSnap.ts.
export const readLandingSnapFlag = (): boolean => readStorageValue("flemo:landing-snap") === "on";

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
const isTouchBlink = (): boolean =>
  detectBlinkEngine() && typeof navigator !== "undefined" && (navigator.maxTouchPoints ?? 0) > 0;

// `flemo:settle-gate` — the render-settle entry gate. ON BY DEFAULT for touch
// WebKit (governedCompiledActive — the governed-compiled tier ships with it),
// for steady-60 desktop Blink sessions (the player rides the main thread
// there, so the entering screen's mount commit would stall its opening — the
// gate is the same protection the touch tiers ship with; it also targets the
// measured ~50ms desktop mount hitch), AND for touch Blink.
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
    return governedCompiledActive() || steadySixtyPlayerEligible() || isTouchBlink();
  } catch {
    return false;
  }
};

// `flemo:handoff=on`, ENGINE side — uncached, so the routing exemption in
// forceCompiledStatus reacts to a DevTools toggle immediately. The player's
// own cached view of the same key is `handoffOverride` below.
export const readHandoffFlag = (): boolean => readStorageValue("flemo:handoff") === "on";

// `flemo:arrivalhold=off` — diagnostic kill-switch for the whole in-flight
// arrival armor (response/arrival/invisible-animation/image holds). Added
// 2026-08-18 for live A/B isolation of the hold machinery itself as a felt-
// jank suspect; default ON (armor engaged) everywhere.
export const readArrivalHoldFlag = (): boolean => readStorageValue("flemo:arrivalhold") !== "off";

// `flemo:preraster=on` — promote the entering content layer from the hold
// onward (react ScreenMotion). Retained as an opt-in probe; the swallow it
// probed is solved by the scrub tier's freeze-on-block opening.
export const readPrerasterFlag = (): boolean => readStorageValue("flemo:preraster") === "on";

// `flemo:imgoffload` — image decode offloader override for the react Router:
// "on" forces it on any engine, "off" opts a legacy device back out, anything
// else defers to the caller's auto-detection (isLegacyAndroidBlink).
export const readImageOffloadOverride = (): "on" | "off" | null => {
  const value = readStorageValue("flemo:imgoffload");
  return value === "on" || value === "off" ? value : null;
};

// ── Cached per-page-load overrides (the transitionPlayer set) ───────────────

// Defaults for the numeric overrides. HANDOFF: six nominal 60Hz frames —
// enough for the entry storm to land and the capped clock to absorb it, early
// enough that the browser owns the long middle and the whole convergence.
// JITTER BAND: below this step size (device px per actual frame) integer
// snapping modulates presented velocity by up to ±0.5px/frame.
export const HANDOFF_MS_DEFAULT = 6 * (1000 / 60);
export const JITTER_BAND_MAX_DEVICE_PX = 4;

// `flemo:apply=scrub` — route EVERY track through the scrub-WAAPI
// value-application path so the per-frame style-write path can be A/B'd
// against it on-device.
let applyOverrideCache: "scrub" | null | undefined;
export const snapshotApplyOverride = (): "scrub" | null => {
  if (applyOverrideCache !== undefined) return applyOverrideCache;
  const value = readStorageValue("flemo:apply");
  applyOverrideCache = value === "scrub" ? value : null;
  return applyOverrideCache;
};

// `flemo:handoff=on`, PLAYER side — cached: the join path runs per track and
// the flag selects a driver for the whole session.
let handoffOverrideCache: "on" | null | undefined;
export const handoffOverride = (): "on" | null => {
  if (handoffOverrideCache !== undefined) return handoffOverrideCache;
  const value = readStorageValue("flemo:handoff");
  handoffOverrideCache = value === "on" ? value : null;
  return handoffOverrideCache;
};

// `flemo:snap` — replaces the platform-default snap policy (see
// composeTransform / defaultAlwaysSnap in transitionPlayer.ts).
let snapOverrideCache: "always" | "off" | "gate" | "hybrid" | null | undefined;
export const snapOverride = (): "always" | "off" | "gate" | "hybrid" | null => {
  if (snapOverrideCache !== undefined) return snapOverrideCache;
  const value = readStorageValue("flemo:snap");
  snapOverrideCache =
    value === "always" || value === "off" || value === "gate" || value === "hybrid" ? value : null;
  return snapOverrideCache;
};

// `flemo:snapband=<n>` — narrows the "hybrid" snap's fractional band so only
// the slowest tail (sub-n device px/frame) goes sub-pixel.
let jitterBandCache: number | undefined;
export const jitterBandMaxDevicePx = (): number => {
  if (jitterBandCache !== undefined) return jitterBandCache;
  const raw = readStorageValue("flemo:snapband");
  const n = raw === null ? NaN : Number(raw);
  jitterBandCache = Number.isFinite(n) && n > 0 ? n : JITTER_BAND_MAX_DEVICE_PX;
  return jitterBandCache;
};

// `flemo:handoffms=<n>` — moves the handoff point per session so an on-device
// round can tell whether a perceived jump tracks the handoff.
let handoffMsCache: number | undefined;
export const handoffMs = (): number => {
  if (handoffMsCache !== undefined) return handoffMsCache;
  const raw = readStorageValue("flemo:handoffms");
  const n = raw === null ? NaN : Number(raw);
  handoffMsCache = Number.isFinite(n) && n >= 0 ? n : HANDOFF_MS_DEFAULT;
  return handoffMsCache;
};

// Test-only: the session override caches are read once per page load; tests
// reset them to exercise each override path in one module instance.
export const resetSessionOverrideCachesForTests = () => {
  applyOverrideCache = undefined;
  snapOverrideCache = undefined;
  handoffOverrideCache = undefined;
  jitterBandCache = undefined;
  handoffMsCache = undefined;
};

// ── Cached URL-armed toggles (layers / freeze) ──────────────────────────────
// The `?flemo-layers=` / `?flemo-freeze=` URL arming stays in the owning
// modules (they just write these storage keys at module load, before the
// first read caches).

// `flemo:layers=resident` — keep SCREEN layers resident at rest instead of
// demoting them LAYER_SETTLE_MS past the flip (see layerSettleHold.ts).
let residentLayersCache: boolean | undefined;
export const residentScreenLayers = (): boolean => {
  if (residentLayersCache !== undefined) return residentLayersCache;
  residentLayersCache = readStorageValue("flemo:layers") === "resident";
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
