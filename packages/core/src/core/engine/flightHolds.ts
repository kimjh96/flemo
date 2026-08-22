import { concludeInlineSettle } from "@transition/animateInline";

import resolveTransition from "@transition/resolveTransition";

import type { TransitionName } from "@transition/typing";

import createArrivalHold from "@core/engine/arrivalHold";
import holdCompositorWarm from "@core/engine/compositorWarmUp";
import { readArrivalHoldFlag, readImageHoldFlag } from "@core/engine/diagnosticFlags";
import { noticeDeviceEmulationOnce } from "@core/engine/emulationNotice";
import { statusChoreographySpanMs } from "@core/engine/flightParticipants";
import { beginFlightWindow } from "@core/engine/flightWindow";
import { beginImageRevealHold } from "@core/engine/imageRevealHold";
import createInvisibleAnimationHold from "@core/engine/invisibleAnimationHold";
import { beginResponseHold } from "@core/engine/responseHold";

// THE HOLDS ONE SCREEN OWNS.
//
// Four pieces of state, and they belong together: the compositor warm-up, the
// in-flight arrival armor, the warm side's image-only hold, and the settle
// timer that outlives COMPLETED. Each spans MANY drive runs — the effect
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

const noop = () => {};

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
  // The WARM side's image-only hold (see the holdsFlightImages block in the
  // drive). Engine-level for the same spanning reason as the arrival hold.
  let releaseFlightImageHold: (() => void) | null = null;
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

    // The WARM side of the navigation — the screens the arrival hold below
    // never covers (the leaving screen of a push/replace, the leaving top of
    // a pop) — is a MOVING layer too, and an <img> still loading there
    // decodes and first-rasters ON that sliding layer: the list page's lazy
    // avatars spawned by the scroll that preceded this push, or a detail
    // photo resolving during the pop back out of it. Glass-measured
    // (2026-08-18, CDP presentation feedback on the live app with delayed
    // image responses): every such mid-flight decode landed a skipped
    // present, 1:1 — the push-side "뚝뚝" that survived the cold-side hold.
    // So the warm side holds its UNPAINTED images for the flight span too,
    // revealed at rest through the same two-rAF landing scheduler (armed
    // further below). Strictly unpainted-only even under flemo:imghold=on:
    // this screen is VISIBLE, and a painted image must never blink out
    // mid-flight. The RELEASE half runs here, BEFORE the arrival blocks: on
    // an interrupt that flips this screen warm→cold, the arrival arm's own
    // beginImageRevealHold would otherwise capture this hold's display:none
    // as the "original" and re-park the image forever.
    const holdsFlightImages = isTransitional && !holdsArrivals;
    if (!holdsFlightImages && releaseFlightImageHold) {
      const release = releaseFlightImageHold;
      releaseFlightImageHold = null;
      if (isTransitional) {
        // Interrupt: a new flight owns this screen — reveal before its
        // first frame.
        release();
      } else {
        deps.scheduleLanding(release);
      }
    }

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
    if (holdsArrivals && !releaseArrivalHold && readArrivalHoldFlag()) {
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
        // Image reveal hold (see imageRevealHold.ts): parks an entering
        // screen's still-loading (and oversized cached) <img> paints to rest
        // so a mid-flight image load OR a re-entry's giant-texture
        // re-composite can't re-raster the sliding layer. OPT-IN on every
        // engine (`flemo:imghold=on`), shipped OFF by default: on WebKit the
        // deferred decode is SYNCHRONOUS at the reveal, which stacks the
        // stall at rest instead of removing it (device: WebKit got worse
        // with the hold on), and the Blink case that motivated it (the
        // Note 9's re-entry swallow) is solved by the auto-gated image
        // decode offloader instead (isLegacyAndroidBlink). The fetch-level
        // responseHold above ships on by default for every engine; this is
        // its <img> analog, retained as a measurement instrument.
        // OPT-IN ONLY (`flemo:imghold=on`). It shipped default-on for the
        // steady-60 desktop profile from 2026-08-18 — the live-app staircase
        // that isolated the F condition ("이미지 로딩 중 전환만 버벅; 캐시된
        // 이미지는 무결") — and the default is retired 2026-08-21 after a
        // desktop A/B rotating the hold per push/pop pair, on a session with
        // images genuinely completing mid-flight, was judged INDISTINGUISHABLE.
        // The touch round the same week measured it as a net loss: it moved
        // ~1.4 in-flight hitches into ~3.6 at the landing, because parking the
        // paint parks the decode with it and the decode still has to happen.
        // The instrument stays for a consumer whose own measurement asks for
        // it; nothing selects it automatically any more.
        const releaseImages =
          readImageHoldFlag() === "on"
            ? beginImageRevealHold(scope, holdSpanMs + GATE_MOTION_MARGIN_MS)
            : noop;
        // The global flight-window latch (see flightWindow.ts): insertion-time
        // machinery outside this drive (the image decode offloader) defers
        // opaque-original reveals to the same rest this release lands.
        const releaseFlightWindow = beginFlightWindow();
        releaseArrivalHold = () => {
          releaseResponses();
          releaseImages();
          releaseAnimations();
          releaseHold();
          releaseFlightWindow();
        };
      }
    }

    if (holdsFlightImages && !releaseFlightImageHold && readArrivalHoldFlag()) {
      // Same protection as the arrival arm: a navigation starting inside a
      // still-pending landing window lands it now, so the deferred reveal
      // can never punch into the new flight.
      deps.landNow();
      const scope = getScope();
      // Warm side, same retirement as the arrival arm above: opt-in only.
      if (scope && readImageHoldFlag() === "on") {
        releaseFlightImageHold = beginImageRevealHold(
          scope,
          statusChoreographySpanMs(scope, resolveTransition(transitionName), status) +
            GATE_MOTION_MARGIN_MS,
          true
        );
      }
    }
  };

  return { sync };
};
