// Evidence-based motion-driver policy, scoped per rendering engine.
//
// BLINK: the COMPILED COMPOSITOR path drives; the rAF player is a diagnostic
// tier behind the force pin. Two pixel-level measurements settled this, both
// taken on real Chrome with per-frame screencast diffing:
// - Deceleration tail: the player's px-snapped inline writes move less than
//   1px per frame near rest, so the presented frames alternate hold/1px-step
//   (measured as ~0 / ~68k changed pixels, alternating) — a visible shiver.
//   The compiled path on translate3d keyframes decays monotonically to rest.
//   The Blink 2D-transform judder the player was ORIGINALLY built to route
//   around disappeared when the keyframe compiler moved every translation to
//   translate3d (direct texture-filtered compositing).
// - Main-thread churn: under 20x CPU throttle a real app's transition window
//   (query refetch + suspense commits) collapsed player-driven 150ms fades
//   into 1-2 presented frames, while Blink's compositor played every fade on
//   time through 300ms stalls.
//
// NON-BLINK: the PLAYER drives. The Chrome measurements above do not
// transfer, because WebKit presents these compiled screen animations FROM
// THE MAIN THREAD — proven on device glass (iPhone Safari screen recording,
// per-frame pixel classification): a refetch commit landing in a tab fade's
// tail froze the pixels at ~60% presented progress for ~80ms while the
// animation clock ran past its end, then the fill snapped the landed screen
// to full contrast — the reported whole-screen blink, on first entry and
// re-entry alike. A wall-clocked CSS animation structurally cannot survive
// that: the block eats its remaining span. The player shares the same main
// thread, so the same block freezes it identically — but its re-anchoring
// resumes FROM THE FREEZE and plays the remainder, delayed-but-complete
// instead of jumped (device-verified: blink gone, overall smoother).
//
// There is deliberately NO automatic driver switching, and none mid-flight:
// the two paths have different clocks, easing evaluation, and write paths, so
// any handoff during motion risks a visible seam. The force pin picks one
// driver for the whole session, and it is the ONLY thing that can.
//
// REMOVED 2026-08-19: the stall-demotion machinery — per-run gap accounting,
// strikes, an irreversible in-session demotion, a `flemo:motion-driver`
// localStorage ledger and its once-per-session probation probe. It existed to
// move a chronically-starved BLINK device onto the compiled tier; Blink now
// starts there (see joinPlayer's gate 2), so it had nothing left to decide.
// Its behavior is described in docs/architecture/driver-routing.md and its
// implementation is in this file's history, if a future engine ever puts the
// player back in production. Values already written to
// `flemo:motion-driver` on users' devices are simply never read again.

// Diagnostic hard override for field debugging (same spirit as
// window.__flemoPlayerGaps): "css@<epoch-ms>" pins the compiled-CSS path,
// "raf@<epoch-ms>" pins the player, bypassing measurement, strikes, and
// probation entirely. Read live on every decision so a DevTools toggle takes
// effect on the next transition. Not a consumer API — intentionally
// undocumented. SESSION storage AND a freshness stamp, both learned the hard
// way: the pin once lived in localStorage, where one forgotten toggle
// silently pinned every future session; moved to sessionStorage, it STILL
// outlived its debugging session, because mobile tab restoration resurrects
// sessionStorage across days — a stale plain "raf" pin on a restored Safari
// tab reproduced the player's whole delay/mid-start profile on every tab
// switch while a pristine private window ran clean. A pin now expires after
// FORCE_PIN_TTL_MS, and anything unstamped or stale is REMOVED on sight so
// an old profile self-heals on its next decision.
const FORCE_KEY = "flemo:motion-driver-force";
export const FORCE_PIN_TTL_MS = 24 * 60 * 60 * 1000;

// Warn once per session while the pin is active: a forgotten force key reads
// as a mysterious cross-site perf regression (it pins EVERY transition), so
// it must never be silent.
let warnedForcedDriver = false;

const readForcedDriver = (): "css" | "raf" | null => {
  try {
    // Strip the legacy localStorage pin (see FORCE_KEY note) on every read:
    // never honored, only removed, so an old profile self-heals on its next
    // decision even if a stale tab rewrites it.
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem(FORCE_KEY);
    } catch {
      // Storage unavailable: nothing to heal.
    }
    if (typeof sessionStorage === "undefined") return null;
    const value = sessionStorage.getItem(FORCE_KEY);
    if (value === null) return null;
    const [driver, stamp] = value.split("@");
    const stampMs = Number(stamp);
    const fresh =
      (driver === "css" || driver === "raf") &&
      stamp !== undefined &&
      Number.isFinite(stampMs) &&
      Math.abs(Date.now() - stampMs) < FORCE_PIN_TTL_MS;
    if (!fresh) {
      // Unstamped (legacy plain "raf"/"css"), malformed, or expired: never
      // honored, only removed.
      sessionStorage.removeItem(FORCE_KEY);
      return null;
    }
    if (!warnedForcedDriver && typeof console !== "undefined") {
      warnedForcedDriver = true;
      // The console IS the destination here: this fires only while a
      // deliberately-set diagnostic key is active, and its whole purpose is
      // that a forgotten pin can never be silent.
      // eslint-disable-next-line no-console
      console.warn(
        `[flemo] motion driver pinned to "${driver}" via sessionStorage ${FORCE_KEY}; ` +
          "remove the key to restore automatic selection (pins expire after 24h)."
      );
    }
    return driver as "css" | "raf";
  } catch {
    return null;
  }
};

export interface DriverPolicy {
  // Whether the rAF player may drive motion on this device.
  playerAllowed: () => boolean;
  // The active diagnostic force pin, if any. A pin bypasses not only the
  // engine default but also the kind-scoped classification (a pinned "raf"
  // session must player-drive EVERY transition to be a useful instrument).
  pinnedDriver: () => "css" | "raf" | null;
}

// Engine probe: is this a CHROMIUM/Blink browser? Read the low-entropy
// userAgentData.brands list and look for the "Chromium" brand every
// Chromium-based engine includes (Chrome, Edge, Brave, Opera, …). Mere
// PRESENCE of navigator.userAgentData is no longer a Blink signal — WebKit
// shipped it (2025), so `!!userAgentData` now reads Safari as Blink and would
// (a) let a WebKit device demote to the freeze-and-jump compiled path after
// a stall streak, (b) route WebKit replay chains onto the compiled path
// (swallowed openings), (c) false-positive iPad's MacIntel+touch as DevTools
// emulation. iOS Chrome is WebKit underneath and ships NO Chromium brand, so
// it correctly reads non-Blink. The brands list is spoofable in principle,
// but a page that lies about its engine gets the driver it asked for; every
// honest Chromium browser is covered.
export const detectBlinkEngine = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const brands = (navigator as { userAgentData?: { brands?: ReadonlyArray<{ brand?: string }> } })
    .userAgentData?.brands;
  if (Array.isArray(brands)) return brands.some((entry) => /chromium/i.test(entry?.brand ?? ""));
  // UA fallback for engines that ship NO userAgentData at all — notably older
  // Android Chromium browsers (Samsung Internet on a Galaxy Note 9 reports no
  // userAgentData, so the brands path read it as non-Blink and stranded it on
  // the rAF player, whose per-frame transform write re-paints a heavy screen at
  // ~30Hz on that GPU; on the compiled compositor tier the same flight is
  // clean). EVERY Android browser is Chromium EXCEPT Firefox (Gecko), so
  // "Android and not Firefox" is Blink. iOS browsers carry no "Android" token —
  // they stay WebKit here, as they must (their compiled tier freeze-and-jumps).
  // Only reached when userAgentData is absent, so a modern spoofing WebKit
  // (which DOES ship userAgentData) never lands in this branch.
  const ua = navigator.userAgent ?? "";
  return /Android/i.test(ua) && !/Firefox|FxiOS/i.test(ua);
};

// LEGACY ANDROID Blink (Samsung Internet / old WebView on Android-10-era
// hardware): a touch Chromium that ships NO UA-CH brands list. The reactive
// demotion above needs one bad flight to learn a device is slow AND re-probes
// on flight one every session (so a genuinely-fast device is never stranded on
// the compositor) — which means a truly weak device janks its FIRST push on
// the player every session before demoting, device-reported as "최초만 버벅,
// 이후 괜찮음". These devices are confidently slow: no UA-CH is a strong proxy
// for pre-2021 Chromium, and the "don't strand a fast device" caution the
// probe exists for simply does not apply to them. So route them to the
// compositor from flight ONE — no player probe. A modern device (UA-CH brands
// present) is excluded and still probes normally. iOS carries no "Android"
// token, so this never touches WebKit.
export const isLegacyAndroidBlink = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const brands = (navigator as { userAgentData?: { brands?: ReadonlyArray<unknown> } })
    .userAgentData?.brands;
  if (Array.isArray(brands)) return false;
  const ua = navigator.userAgent ?? "";
  return /Android/i.test(ua) && !/Firefox|FxiOS/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 0;
};

// DESKTOP macOS WebKit — the Safari session that routes to the COMPILED tier
// (joinPlayer's gate 3: macOS Safari caps rAF at 60Hz, so the player can only
// ever paint half a ProMotion panel's frames there). Touch WebKit is excluded
// deliberately: real iPhones/iPads — including iPads that spoof a Mac platform,
// which report maxTouchPoints > 0 — keep the device-verified player. jsdom
// reports an empty platform and so is never desktop-Mac WebKit, which keeps the
// unit suites on the player tier.
//
// The predicate lives here, beside the other engine probes, because two callers
// must agree on it exactly: the routing gate that sends this session to the
// compiled tier, and the render-settle gate default that makes that tier safe
// (see readSettleGateFlag). They drifted apart once already — routing landed
// desktop Safari on a wall-clocked animation while the gate that protects it
// stayed touch-only.
export const isDesktopMacWebKit = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return (
    !detectBlinkEngine() &&
    (navigator.maxTouchPoints ?? 0) === 0 &&
    /Mac/.test(navigator.platform ?? "")
  );
};

export const createDriverPolicy = (playerByDefault: boolean = false): DriverPolicy => ({
  playerAllowed: () => {
    const forced = readForcedDriver();
    if (forced) return forced === "raf";
    return playerByDefault;
  },
  pinnedDriver: readForcedDriver
});

// Engine-scoped default: the PLAYER (see the file header — it was born on
// Blink, where compositor-driven animations miss presentation deadlines on
// raster-heavy layers; the 2026-08 WebKit campaign then made it the only
// reliable opening there too). Routing narrows this heavily: Blink takes the
// compiled tier before ever consulting the policy, so in practice the default
// reaches production only on touch WebKit.
const driverPolicy = createDriverPolicy(true);

export default driverPolicy;
