import { detectBlinkEngine, isDesktopMacWebKit } from "@platform/engineProbes";
import { governedCompiledActive } from "@platform/governedCompiled";
import { steadySixtyDesktopProfile } from "@platform/steadySixtyCadence";

// THE PLATFORM PROFILE.
//
// Everything flemo does differently per browser, resolved in one place, as one
// object of named decisions.
//
// Why it exists: these decisions used to be re-derived at each call site, and
// the binding was doing most of the deriving — @flemo/react called
// `detectBlinkEngine`, `governedCompiledActive` and five flag readers
// NINETEEN times and combined them into release policy itself. That made the
// binding a second policy layer (so a Solid or Vue binding would have to
// re-implement the policy, not just render it), and it let the two sides
// disagree: the settle gate's ARMING widened in the binding while the flag that
// enables it stayed WebKit-only in core, and Android ran ungated for two
// release rounds before anyone noticed.
//
// A binding's job is now to ASK and to RENDER, never to decide.
//
// NOT CACHED, deliberately. Every field re-reads its probes live, because the
// terms are not all constant for a session: the steady-60 verdict below only
// forms after two measured flights. Resolve it per decision (per render, per
// flight); never hoist one to module scope.
//
// There is no override channel. Every decision here is derived from the
// environment alone — the `flemo:*` session keys that used to force each of
// these both ways were diagnostic instruments that shipped to consumers, and
// they were removed outright rather than merely defaulted off.

export interface PlatformProfile {
  /**
   * This engine presents its compiled screen animations FROM THE MAIN THREAD
   * (WebKit) rather than off the compositor (Blink). Everything about
   * protecting a flight's opening follows from this one fact: where the clock
   * is stamped on the main thread, a heavy commit between the stamp and the
   * first paint is aged away rather than ridden through.
   */
  readonly mainThreadPresented: boolean;

  /**
   * Flip the hold attribute straight onto the DOM inside the readiness rAF
   * instead of routing the release through a state commit. A rAF callback and
   * its own frame's rendering update are atomic, so clock-start and first paint
   * become simultaneous by construction.
   *
   * Device-verified on three populations; see the resolver below. An
   * authored `driver: "native"` transition takes it too — pass
   * `authoredNativeDriver` to fold that in.
   */
  readonly atomicReleaseFlip: boolean;

  /**
   * Hand the release's reconcile to the NEXT frame rather than flushing it
   * synchronously, so it stops competing with the flight's first present.
   * Only meaningful where the flip already released the hold — without the
   * flip, the state commit IS the release.
   */
  readonly deferReleaseCommit: boolean;

  /**
   * Hold the release until the entering screen's mount render quiesces, so a
   * heavy screen's own commit storm cannot eat the opening frames.
   */
  readonly renderSettleGate: boolean;

  /**
   * Park a push's entering screen ON TOP at near-zero opacity (so the browser
   * genuinely paints its tiles during the hold) rather than beneath its cover.
   */
  readonly parkOver: boolean;

  /**
   * Rewrite oversized `<img>` sources to decoded-to-scale blobs off the main
   * thread. Auto on legacy Android Blink only — it touches consumer content,
   * so it must never run where the paint is already cheap.
   */
  readonly imageDecodeOffload: boolean;
}

export interface PlatformProfileInput {
  /**
   * The transition being flown authored `driver: "native"` — an explicit opt-in
   * to clock surgery, which carries the atomic release flip with it. The
   * binding knows this and core does not, so it is the one input the profile
   * takes.
   */
  readonly authoredNativeDriver?: boolean;
}

// A touch Blink session — the phone class the settle gate was actually
// validated on. This is NOT a weak-device predicate: the evidence is about the
// phenomenon (a heavy mount commit stalling even the compositor's initial
// layerization), which does not care whether the device is fast.
// No navigator guard: detectBlinkEngine() returns false without one, so the
// short circuit already covers it.
const isTouchBlink = (): boolean => detectBlinkEngine() && navigator.maxTouchPoints > 0;

/**
 * The render-settle entry gate, as its own predicate — the flight routing asks
 * for it directly (a PUSH only forces the compiled tier behind the gate), and
 * the profile publishes it as `renderSettleGate`. One definition, because the
 * two drifted apart once already: the ARMING widened in the react binding while
 * core's stayed WebKit-only, and Android ran ungated for two release rounds.
 *
 * ON for touch WebKit (governedCompiledActive — the governed-compiled tier
 * ships with it), for steady-60 desktop Blink sessions, for touch Blink, AND
 * for desktop macOS Safari.
 *
 * The steady-60 desktop term is a PROFILE, not a driver claim. It was written
 * when a verified steady-60 session routed to the player, whose main-thread
 * per-frame write the entering mount commit would stall; that routing is gone
 * (Blink runs compiled everywhere since 2026-08-19) but the term stays, because
 * the reason that survives is the tier-independent one: the measured ~50ms
 * desktop mount hitch ages a wall-clocked compiled animation just as it starved
 * the player.
 *
 * Touch Blink was the gap: the pop-convergence round (de35c13) widened the
 * arming to "ALL engines" after a device A/B on a demoted Note 9 falsified the
 * WebKit-only reading — its heavy detail mount runs a ~290ms main-thread task
 * that stalls even the compositor's initial commit, so gating the release to
 * AFTER that task measurably helped. Re-confirmed on the same device class
 * 2026-08-19.
 *
 * Desktop macOS Safari was the same gap one platform over. It runs the compiled
 * tier on purpose (macOS Safari caps rAF at 60Hz), but WebKit presents compiled
 * animations from the MAIN THREAD, so a heavy entering mount eats the opening
 * exactly as it does on a phone. Frame-level measurement of the docs site's own
 * Home -> Showcase push (2026-08-20, production build, WebKit): the entering
 * screen's mount blocked the main thread for 103-135ms while the animation's
 * clock ran, so the FIRST presented frame already stood at 48-77% progress; the
 * release commit then re-anchored the animation and it replayed from zero — a
 * jump followed by a rewind, both visible. The same flight on Chromium was
 * clean, which is why it read as Safari-only.
 *
 * The gate is adaptive, which is why this is safe to arm widely: with no
 * qualifying mount commit inside firstWaitMs it releases with no felt delay, so
 * a fast phone pays nothing for carrying it.
 */
export const settleGateActive = (): boolean =>
  governedCompiledActive() || steadySixtyDesktopProfile() || isTouchBlink() || isDesktopMacWebKit();

export const resolvePlatformProfile = (input: PlatformProfileInput = {}): PlatformProfile => {
  const blink = detectBlinkEngine();
  const mainThreadPresented = !blink;
  const touchWebKit = governedCompiledActive();

  return {
    mainThreadPresented,
    // Scoped to non-Blink: Blink's compiled animation is compositor-driven and
    // rides a main-thread gap without aging, so the flip would buy it nothing.
    //
    // Desktop macOS Safari (isDesktopMacWebKit) routes compiled and presents
    // from the main thread — the exact combination the flip was built for. The
    // flip's known failure mode is a player-routed flight, which that session
    // cannot hit: gate 3 pins it to the compiled tier for every flight.
    atomicReleaseFlip:
      mainThreadPresented &&
      (input.authoredNativeDriver === true || touchWebKit || isDesktopMacWebKit()),
    // Device timelines (iPhone, 2026-08-20) show a dropped frame AT THE RELEASE
    // on 11 of 18 stock PUSH flights and 0 of 17 POPs — the asymmetry a
    // mount-heavy entering commit predicts. The compiled clock starts on the
    // release frame's style change and WebKit presents it from the main thread,
    // so React's reconcile of that same update competes with the first present.
    //
    // The `flushSync` this defers exists for a real defect: an unrelated commit
    // landing in the flip->reconcile window renders the STALE held state and
    // writes the paused hold attribute back over a RUNNING animation. Deferring
    // alone would reopen it, so the binding pairs this with a render-phase read
    // of the imperative release (ScreenMotion's releasedKeyRef).
    deferReleaseCommit: touchWebKit,
    renderSettleGate: settleGateActive(),
    // Park a push's entering screen ON TOP at near-zero opacity so the browser
    // genuinely paints its tiles during the hold.
    parkOver: touchWebKit,
    // THE IMAGE DECIDES, NOT THE DEVICE.
    //
    // This used to be armed by `isLegacyAndroidBlink` — an old BROWSER. The
    // cost it exists to remove is not created by the browser: a 48px avatar
    // holding a 37-megapixel original is expensive to decode wherever it
    // lands. Device-measured on a Galaxy Z Flip 4, a 2022 phone on a current
    // Chrome that the browser-age probe excludes: a push janks without the
    // offloader and is smooth with it, judged in both directions.
    //
    // The offloader already makes the decision that matters, per image and
    // from the source's own bytes: only a source carrying more than
    // OVERSIZE_AREA_RATIO times its display area is touched, and a well-sized
    // one is left exactly as authored with zero added work. A second gate on
    // top of that, keyed on something else entirely, only decided WHICH
    // populations were allowed to benefit.
    //
    // Still nothing without a browser: SSR verifies nothing, and this profile's
    // rule is that an unverified environment arms nothing.
    imageDecodeOffload: typeof navigator !== "undefined"
  };
};
