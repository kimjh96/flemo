// Rendering-engine probes: the small set of "what kind of browser is this"
// predicates the engine's routing and its per-platform defaults key on. Pure
// reads of `navigator` — no state, no storage, no learning.
//
// HISTORY, so the ladder is not re-climbed. This file used to be
// `driverPolicy.ts` and owned a second motion driver: an rAF PLAYER that wrote
// each frame's pose from the main thread, alongside the compiled (CSS/WAAPI)
// compositor path. It also owned the machinery for choosing between them — a
// per-origin demotion ledger (`flemo:motion-driver`), a once-per-session
// probation probe, and a hard force pin (`flemo:motion-driver-force`).
//
// All of it is gone:
// - DEMOTION was removed 2026-08-19 when Blink was unified onto the compiled
//   tier. It existed to move a chronically-starved Blink device to the tier
//   Blink now always starts on, so it had nothing left to decide.
// - The PLAYER itself was retired 2026-08-22. By then the routing sent every
//   Blink session, every desktop macOS WebKit session and every touch WebKit
//   session (all three animating statuses) to the compiled tier, so the only
//   sessions it still drove were desktop Firefox on Windows/Linux — and the
//   compiled tier is what every other desktop already runs. Its measured
//   costs are recorded where they were paid: the 120Hz partial-present trace
//   in the Blink notes, the 30Hz Low Power Mode ceiling in
//   createSwipeController's DO-NOT-RETRY block.
// - The FORCE PIN went with it. With one driver there is nothing to pin, and
//   a pin that silently altered the motion it was meant to observe was its own
//   measurement hazard (a stale sessionStorage pin, resurrected by mobile tab
//   restoration, once reproduced the player's whole delay profile for days).
//
// Values already written to `flemo:motion-driver` / `flemo:motion-driver-force`
// on users' devices are simply never read again.

// Engine probe: is this a CHROMIUM/Blink browser? Read the low-entropy
// userAgentData.brands list and look for the "Chromium" brand every
// Chromium-based engine includes (Chrome, Edge, Brave, Opera, …). Mere
// PRESENCE of navigator.userAgentData is no longer a Blink signal — WebKit
// shipped it (2025), so `!!userAgentData` now reads Safari as Blink and would
// route WebKit sessions onto Blink-only treatments and false-positive iPad's
// MacIntel+touch as DevTools emulation. iOS Chrome is WebKit underneath and
// ships NO Chromium brand, so it correctly reads non-Blink. The brands list is
// spoofable in principle, but a page that lies about its engine gets the
// treatment it asked for; every honest Chromium browser is covered.
export const detectBlinkEngine = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const brands = (navigator as { userAgentData?: { brands?: ReadonlyArray<{ brand?: string }> } })
    .userAgentData?.brands;
  if (Array.isArray(brands)) return brands.some((entry) => /chromium/i.test(entry?.brand ?? ""));
  // UA fallback for engines that ship NO userAgentData at all — notably older
  // Android Chromium browsers (Samsung Internet on a Galaxy Note 9 reports no
  // userAgentData, so the brands path read it as non-Blink and stranded it on
  // treatments meant for WebKit). EVERY Android browser is Chromium EXCEPT
  // Firefox (Gecko), so "Android and not Firefox" is Blink. iOS browsers carry
  // no "Android" token — they stay WebKit here, as they must. Only reached
  // when userAgentData is absent, so a modern spoofing WebKit (which DOES ship
  // userAgentData) never lands in this branch.
  const ua = navigator.userAgent ?? "";
  return /Android/i.test(ua) && !/Firefox|FxiOS/i.test(ua);
};

// LEGACY ANDROID Blink (Samsung Internet / old WebView on Android-10-era
// hardware): a touch Chromium that ships NO UA-CH brands list.
//
// READ THE PREDICATE FOR WHAT IT IS: the brands list ships in Chromium 89
// (2021), so this selects an old BROWSER, not slow hardware. The same Galaxy
// Note 9 matches on Samsung Internet and is EXCLUDED on a current Chrome. That
// makes it a fair proxy for a device that has stopped getting browser updates,
// and a poor one for "this phone is weak" — anything gated on it is measured
// against one population and shipped to another unless that is kept in mind.
//
// No UA-CH is a strong proxy for pre-2021 Chromium, and these devices are
// confidently slow —
// they take the governed head kit (a compiled flight's opening held in a flat
// head) from flight ONE rather than swallowing the curve's start on a
// 120-260ms mount commit. A modern device (UA-CH brands present) is excluded.
// iOS carries no "Android" token, so this never touches WebKit.
export const isLegacyAndroidBlink = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const brands = (navigator as { userAgentData?: { brands?: ReadonlyArray<unknown> } })
    .userAgentData?.brands;
  if (Array.isArray(brands)) return false;
  const ua = navigator.userAgent ?? "";
  return /Android/i.test(ua) && !/Firefox|FxiOS/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 0;
};

// DESKTOP macOS WebKit — the Safari session that takes the desktop compiled
// profile: the atomic release flip, the flat desktop head, and the
// render-settle gate that makes a wall-clocked, main-thread-presented
// animation safe there. Touch WebKit is excluded deliberately: real
// iPhones/iPads — including iPads that spoof a Mac platform, which report
// maxTouchPoints > 0 — take the touch governed profile instead. jsdom reports
// an empty platform and so is never desktop-Mac WebKit.
//
// The predicate lives here, beside the other engine probes, because two
// callers must agree on it exactly: the routing that selects the desktop
// profile, and the render-settle gate default that makes that profile safe
// (see readSettleGateFlag). They drifted apart once already.
//
// Known imprecision, unchanged from when this predicate was written: it does
// not test the ENGINE, so desktop Firefox on macOS also reads true and takes
// the same desktop compiled profile. That is the profile every other desktop
// runs, so it is benign — but the name overstates what is measured.
export const isDesktopMacWebKit = (): boolean => {
  if (typeof navigator === "undefined") return false;
  // `maxTouchPoints === 0` without a nullish fallback: an environment that
  // reports NO touch count is not a verified non-touch Mac, so it must keep
  // the mobile-safe default rather than be defaulted onto the desktop profile.
  return !detectBlinkEngine() && navigator.maxTouchPoints === 0 && /Mac/.test(navigator.platform);
};

// DESKTOP Blink — a Chromium session with no touch surface. The defaults that
// key on this are about what BLINK does (it culls the raster of an occluded
// layer) and what a DESKTOP can afford (GPU memory for a resident layer, one
// screen kept alive across a quick out-and-back), neither of which is a
// property of the display's refresh rate.
//
// `maxTouchPoints === 0` without a nullish fallback, the same reading
// isDesktopMacWebKit uses.
export const isDesktopBlink = (): boolean =>
  detectBlinkEngine() && typeof navigator !== "undefined" && navigator.maxTouchPoints === 0;
