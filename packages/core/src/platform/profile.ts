import {
  readDeferReleaseCommitFlag,
  readDesktopReleaseFlipFlag,
  readPrerasterFlag,
  readRestLayerPromotionFlag,
  readSettleGateFlag
} from "@core/engine/diagnosticFlags";

import { detectBlinkEngine } from "@platform/engineProbes";
import { governedCompiledActive } from "@platform/governedCompiled";

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
// NOT CACHED, deliberately. Every field reads its flag live, so a DevTools
// toggle takes effect on the next navigation without a reload — the uncached
// semantics the flag registry documents. Resolve it per decision (per render,
// per flight); never hoist one to module scope.

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
   * Device-verified on three populations; see readDesktopReleaseFlipFlag. An
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
   * Keep the screen scope's layer promoted at REST. Off everywhere by default:
   * a promotion is also a stacking context, and at rest it outranks any
   * consumer overlay inside the screen.
   */
  readonly restLayerPromotion: boolean;
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

export const resolvePlatformProfile = (input: PlatformProfileInput = {}): PlatformProfile => {
  const blink = detectBlinkEngine();
  const mainThreadPresented = !blink;
  const touchWebKit = governedCompiledActive();

  return {
    mainThreadPresented,
    // Scoped to non-Blink: Blink's compiled animation is compositor-driven and
    // rides a main-thread gap without aging, so the flip would buy it nothing.
    atomicReleaseFlip:
      mainThreadPresented &&
      (input.authoredNativeDriver === true || touchWebKit || readDesktopReleaseFlipFlag()),
    deferReleaseCommit: readDeferReleaseCommitFlag(),
    renderSettleGate: readSettleGateFlag(),
    parkOver: readPrerasterFlag() || touchWebKit,
    restLayerPromotion: readRestLayerPromotionFlag()
  };
};

/**
 * The REST-promotion decision on its own, as a module-stable function.
 *
 * A binding that server-renders must read this through a hydration-scoped
 * snapshot (it reaches the DOM as an inline style, so a render-phase read
 * mismatches the server HTML), and React's `useSyncExternalStore` requires the
 * reader identity to be stable across renders — which an inline
 * `() => resolvePlatformProfile().restLayerPromotion` would not be.
 */
export const restLayerPromotionEnabled = (): boolean => resolvePlatformProfile().restLayerPromotion;
