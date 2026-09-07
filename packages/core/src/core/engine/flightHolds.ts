import { concludeInlineSettle } from "@transition/animateInline";

import resolveTransition from "@transition/resolveTransition";

import type { TransitionName } from "@transition/typing";

import createArrivalHold from "@core/engine/arrivalHold";
import { noticeDeviceEmulationOnce } from "@core/engine/emulationNotice";
import { statusChoreographySpanMs } from "@core/engine/flightParticipants";
import { beginFlightWindow } from "@core/engine/flightWindow";
import createInvisibleAnimationHold from "@core/engine/invisibleAnimationHold";
import { beginResponseHold } from "@core/engine/responseHold";

// THE HOLDS ONE SCREEN OWNS.
//
// The in-flight arrival armor spans MANY drive runs — the effect re-runs
// mid-transition — so it cannot live in a run's closure, and it has to be
// handed back exactly once when the screen leaves the statuses that justified
// it.
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
  /**
   * Hand everything back because the screen is GONE, not because it finished.
   *
   * Every release above is driven by a LATER sync pass, and a screen that
   * unmounts mid-flight never has one. Two of the holds it armed are not the
   * screen's to take with it: the response park and the global flight window
   * are session-wide latches, and the window's refcount has no timer behind
   * it — measured still open, with nothing in the air, for the rest of the
   * session after one interrupted push.
   *
   * Immediate rather than scheduled: there is no landing left to protect.
   * Idempotent, and a no-op when nothing was armed.
   */
  readonly abandon: () => void;
}

export const createFlightHolds = (deps: FlightHoldsDeps): FlightHolds => {
  let releaseArrivalHold: (() => void) | null = null;

  const sync = ({
    isTransitional,
    isActive,
    status,
    transitionName,
    getScope
  }: FlightHoldsInput) => {
    // Motion judged under DevTools device emulation chases phantoms — warn
    // once (see emulationNotice.ts).
    if (isTransitional) noticeDeviceEmulationOnce();

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

  const abandon = () => {
    if (!releaseArrivalHold) return;
    const release = releaseArrivalHold;
    releaseArrivalHold = null;
    release();
  };

  return { sync, abandon };
};
