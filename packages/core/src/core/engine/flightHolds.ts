import { concludeInlineSettle } from "@transition/animateInline";

import resolveTransition from "@transition/resolveTransition";

import type { TransitionName } from "@transition/typing";

import createArrivalHold from "@core/engine/arrivalHold";
import holdCompositorWarm from "@core/engine/compositorWarmUp";
import { noticeDeviceEmulationOnce } from "@core/engine/emulationNotice";
import { statusChoreographySpanMs } from "@core/engine/flightParticipants";
import { beginFlightWindow } from "@core/engine/flightWindow";
import createInvisibleAnimationHold from "@core/engine/invisibleAnimationHold";
import { beginResponseHold } from "@core/engine/responseHold";

// THE HOLDS ONE SCREEN OWNS.
//
// Three pieces of state, and they belong together: the compositor warm-up, the
// in-flight arrival armor, and the settle timer that outlives COMPLETED. Each
// spans MANY drive runs — the effect
// re-runs mid-transition — so none of them can live in a run's closure, and
// each has to be handed back exactly once when the screen leaves the statuses
// that justified it.
//
// They were four `let`s at the top of the engine, mutated from a hundred and
// eighty lines in the middle of `driveScreenLifecycle`, and nothing else in
// the engine touched them. That is a stateful object wearing a closure.
//
// The two callbacks this takes are the engine's, not this module's: a hold's
// release may have to LAND immediately (a new flight must never inherit a
// pending landing) or be deferred past the COMPLETED flip.

/** Margin over the choreography span before a hold's own backstop fires. */
const GATE_MOTION_MARGIN_MS = 1500;

// The warm-up outlives COMPLETED by this window. The convergence storm —
// status-flip commits, the covered screen's freeze, the landing reveal two
// frames past COMPLETED — lands right AFTER the motion rests, where frame
// production is back to on-demand; measured on real Chrome (180s of
// hand-driven journeys) as 17 dropped frames clustered at 400-700ms into
// 600ms flights with no compositor animation live. Forcing frames through the
// settle keeps that window on the vsync cadence.
const WARM_SETTLE_MS = 400;

export interface FlightHoldsDeps {
  /**
   * Land any pending deferred landing NOW. A navigation starting inside a
   * still-pending window must not let that window's reveal punch into it.
   */
  readonly landNow: () => void;
  /** Defer a release to the frames past the COMPLETED flip. */
  readonly scheduleLanding: (land: () => void) => void;
}

export interface FlightHoldsInput {
  readonly isTransitional: boolean;
  readonly isActive: boolean;
  readonly status: string;
  readonly transitionName: TransitionName;
  readonly getScope: () => HTMLElement | null | undefined;
}

export interface FlightHolds {
  /** Reconcile every hold with what this drive run says the screen is doing. */
  readonly sync: (input: FlightHoldsInput) => void;
}

export const createFlightHolds = (deps: FlightHoldsDeps): FlightHolds => {
  let releaseArrivalHold: (() => void) | null = null;
  // This screen's hold on the compositor warm-up (see compositorWarmUp.ts).
  // Engine-level for the same reason as the arrival hold: the driver effect
  // re-runs mid-transition, and the warm-up must span those re-runs and end
  // only when the screen leaves its transitional statuses.
  let releaseWarm: (() => void) | null = null;
  // The warm-up outlives COMPLETED by the settle window. The convergence
  // storm — status-flip commits, the covered screen's freeze, the landing
  // reveal two frames past COMPLETED — lands right AFTER the motion rests,
  // where frame production is back to on-demand; measured on the user's own
  // machine (attached real Chrome, 180s of hand-driven journeys) as 17
  // dropped frames clustered at 400-700ms into 600ms flights with no
  // compositor animation live — the convergence tremor. Forcing frames
  // through the settle keeps that window on the vsync cadence, exactly what
  // a DevTools Performance recording does when it masks the judder.
  let warmSettleTimer: ReturnType<typeof setTimeout> | null = null;

  const sync = ({
    isTransitional,
    isActive,
    status,
    transitionName,
    getScope
  }: FlightHoldsInput) => {
    // Keep the compositor producing frames for as long as this screen is in
    // motion (opening spin-up) AND through the settle window past COMPLETED
    // (the convergence storm) — see warmSettleTimer above.
    if (isTransitional) {
      // Motion judged under DevTools device emulation chases phantoms — warn
      // once (see emulationNotice.ts).
      noticeDeviceEmulationOnce();
      // A navigation starting inside the settle window keeps the SAME hold:
      // cancel the pending release without spending it.
      if (warmSettleTimer) {
        clearTimeout(warmSettleTimer);
        warmSettleTimer = null;
      }
      if (!releaseWarm) releaseWarm = holdCompositorWarm();
    }
    if (!isTransitional && releaseWarm && !warmSettleTimer) {
      if (typeof setTimeout === "function") {
        warmSettleTimer = setTimeout(() => {
          warmSettleTimer = null;
          releaseWarm?.();
          releaseWarm = null;
        }, WARM_SETTLE_MS);
      } else {
        releaseWarm();
        releaseWarm = null;
      }
    }

    // No content landing while the screen is in motion: the COLD side of a
    // navigation (freshly-mounted enter on push/replace, unfreezing pop
    // destination — the screens whose async data can resolve mid-flight)
    // holds in-flight DOM swaps and reflects them at rest. Armed from the
    // FIRST transitional commit, not at the anim-hold release: an earlier
    // policy armed at release on the reasoning that a pre-release landing is
    // invisible (the screen is parked/held) and reflecting it immediately is
    // free — but "free" counted only pixels, not the rendering update. A
    // query's commit task finishing just before the RELEASE frame's vsync
    // joins that frame's rendering update UNHELD, and its full style/layout
    // ages the compiled clock (timestamped at the frame's top) before the
    // flight ever presents — device-measured as the intermittent "gathers
    // then rushes" opening on a multi-query detail push (a timing lottery:
    // the collision needs the commit to land in the release frame itself).
    // Held from the first commit, every arrival in the hold window is
    // display:none (the compiled HELD_ARRIVAL rule) — the release frame can
    // only ever carry cheap, layout-skipped arrivals, and everything lands
    // in ONE commit at rest exactly like a mid-flight arrival always has
    // (the delayed-but-complete contract, now uniform across the whole
    // navigation window).
    const holdsArrivals =
      isTransitional &&
      (isActive ? status === "PUSHING" || status === "REPLACING" : status === "POPPING");

    if (!holdsArrivals && releaseArrivalHold) {
      // COMPLETED, IDLE, or an interrupt that flipped this screen's role.
      const release = releaseArrivalHold;
      releaseArrivalHold = null;
      if (isTransitional) {
        // Interrupt: a new transition owns the glass right now — land
        // everything immediately, before its first frame.
        release();
      } else {
        deps.scheduleLanding(release);
      }
    }
    if (holdsArrivals && !releaseArrivalHold) {
      // A navigation starting inside a still-pending landing window: land it
      // now so the deferred reveal can never punch into the new flight.
      deps.landNow();
      const scope = getScope();
      if (scope) {
        // The same cold screens whose commits the hold shields also carry
        // the invisible-animation layer storm (see invisibleAnimationHold.ts)
        // — hold their unseen animations for the same span. And the reveal
        // commits are TRIGGERED by network responses resolving mid-flight
        // (see responseHold.ts — every method; real reveals arrive as GET
        // selects, POST RPCs, and HEAD counts alike): parking those moves the
        // reveal's REACT RENDER — the script cost display:none cannot touch,
        // the player's convergence frame famine — to rest, where the arrival
        // hold was going to reveal its pixels anyway. Never a stream, and
        // bounded by the WHOLE choreography's span (a 3s authored Part must
        // not see parked responses flushed into its middle just because the
        // screen itself lands at 700ms). All releases run together at every
        // consumption path (early/deferred landing, interrupt, re-arm), so
        // content lands, animations resume, and responses deliver in one
        // commit at rest.
        // A NAVIGATION owns its participants (same rule as the player join):
        // conclude any running swipe settle before the compiled flight
        // drives, or it keeps interpolating toward its own target underneath.
        concludeInlineSettle(scope);
        const releaseHold = createArrivalHold(scope);
        const releaseAnimations = createInvisibleAnimationHold(scope);
        const holdSpanMs = statusChoreographySpanMs(
          scope,
          resolveTransition(transitionName),
          status
        );
        const releaseResponses = beginResponseHold(holdSpanMs + GATE_MOTION_MARGIN_MS);
        // The global flight-window latch (see flightWindow.ts): insertion-time
        // machinery outside this drive (the image decode offloader) defers
        // opaque-original reveals to the same rest this release lands.
        const releaseFlightWindow = beginFlightWindow();
        releaseArrivalHold = () => {
          releaseResponses();
          releaseAnimations();
          releaseHold();
          releaseFlightWindow();
        };
      }
    }
  };

  return { sync };
};
