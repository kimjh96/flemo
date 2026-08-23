import { DESKTOP_HEAD_MS, GOVERNED_HEAD_MS } from "@transition/compileTransitionStyles";

import type { Transition } from "@transition/typing";

import {
  readBlinkGovernedOverride,
  readCreepHeadFlag,
  readDesktopHeadFlag,
  readSettleGateFlag
} from "@core/engine/diagnosticFlags";
import { learnedFrameIntervalMs } from "@platform/displayCadence";
import { COMPILED_TIER_MAX_INTERVAL_MS } from "@platform/displayProbe";
import {
  detectBlinkEngine,
  isDesktopMacWebKit,
  isLegacyAndroidBlink
} from "@platform/engineProbes";
import { governedCompiledActive } from "@platform/governedCompiled";

// HOW THIS ONE FLIGHT IS FLOWN.
//
// The platform profile (see @platform/profile) answers "what kind of browser
// is this". This answers the next question down: given that browser, THIS
// navigation's status, and THIS transition's authored options — which opening
// treatment does the flight get, and may the engine touch its clock?
//
// Every field was one `const` in the middle of driveScreenLifecycle, computed
// among four hundred lines of unrelated wiring. Together they are a single
// decision with a name, and the evidence behind each one belongs beside it.
//
// Read once per drive run, never cached: the flags feeding it are read live so
// a DevTools toggle lands on the next navigation.

export interface FlightRouting {
  /** This flight has motion to drive at all (not skipped, and it resolves). */
  readonly hasDrivableMotion: boolean;

  /**
   * The engine may perform CLOCK SURGERY on this flight — the first-frame
   * hold, the flight-start anchor, stall re-anchoring. Authored
   * `driver: "native"` pins only, and never on Blink.
   *
   * Every one of those mutates a running animation's timing (WAAPI pause/play,
   * startTime shifts), and the 2026-08 iPhone falsification series established
   * that on WebKit any such touch costs the accelerated out-of-process path or
   * desyncs its re-sync. The default therefore runs the compiled animation
   * UNTOUCHED and protects the opening by release scheduling instead. An author
   * who pins "native" takes the main-thread-presentation trade knowingly.
   */
  readonly nativeSurgeryAllowed: boolean;

  /** Touch WebKit on the governed compiled tier. */
  readonly touchGoverned: boolean;

  /**
   * Touch WebKit whose STATUS also takes the flat head: POP always, PUSH once
   * the settle gate has moved the mount weight out of the release.
   */
  readonly forceCompiled: boolean;

  /**
   * This flight gets the GOVERNED HEAD KIT — a flat opening segment baked into
   * the keyframes, so a commit that ages the wall clock eats the head instead
   * of the curve's start.
   */
  readonly governedHead: boolean;

  /**
   * Desktop macOS Safari's own flat head: the same compiled clock presented
   * from the main thread, with its own lengths and its own gate attribute.
   * Arming it retires the birth anchor — two interventions on one clock is the
   * pairing the touch tier was built to avoid.
   */
  readonly desktopHead: boolean;

  /** The head's length for this status, in milliseconds. 0 when there is none. */
  readonly birthHoldMs: number;

  /**
   * A SLIDE on the governed touch tier. It stands the wall-clock accelerators
   * down for the same reason `forceCompiled` does, and covers one case that
   * predicate does not: a touch-WebKit PUSH with the settle gate turned off.
   *
   * Named `governedSoftenActive` until 2026-08, after the front-softening
   * treatment it shipped beside. That treatment is gone; this outlived it
   * because what it guards is the clock, not the curve.
   */
  readonly governedSlide: boolean;

  /**
   * Keep a frame source alive for the flight. Compiled Blink only: a
   * compositor-driven flight leaves the main thread idle, and Chrome then
   * paces its macOS ProMotion presentation unevenly — video-measured as
   * drops and double-steps the eye reads as trembling.
   */
  readonly framePacingKeepalive: boolean;

  /** Arm the creep head beside the governed one (`flemo:creep`). */
  readonly creepHead: boolean;
}

export interface FlightRoutingInput {
  readonly status: string;
  readonly transition: Transition;
  /** The scope carries the skip marker for this flight. */
  readonly skipAnimation: boolean;
  /** The active variant resolves a motion. */
  readonly hasActiveMotion: boolean;
  /** The active variant has an authored animation at all. */
  readonly hasAnimation: boolean;
}

/** A touch device, on either engine. No navigator means no touch surface. */
const hasTouch = (): boolean => typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

export const resolveFlightRouting = (input: FlightRoutingInput): FlightRouting => {
  const { status, transition, skipAnimation, hasActiveMotion, hasAnimation } = input;
  const blink = detectBlinkEngine();
  const touch = hasTouch();

  const touchGoverned = !blink && touch && governedCompiledActive();

  // The governed head kit for touch Blink: a slow device's commits age a BARE
  // compiled flight's clock past the whole opening (the Note 9 profile:
  // 120-260ms mount tasks).
  //
  // Known gap, deliberately not closed here: a modern-but-weak touch Blink
  // (UA-CH present, so not legacy) used to earn this kit through the driver
  // demotion machinery, which is gone. The render-settle gate covers the same
  // mount weight from the other side, default-on for touch Blink since #268.
  // Extending the kit to ALL touch Blink is the obvious next lever and must NOT
  // be taken blind: the 2026-08-14 round reverted exactly that blanket
  // treatment when fast devices picked up the compiled landing snap.
  //
  // `flemo:governed` is how that gap gets measured rather than argued about: it
  // arms or disarms the kit on a device whose browser age says otherwise, which
  // is the only way to find out whether a given phone wants it.
  const governedOverride = readBlinkGovernedOverride();
  const blinkGoverned =
    blink &&
    touch &&
    (governedOverride === "on" || (governedOverride !== "off" && isLegacyAndroidBlink()));

  // POP always: device-measured, a heavy returning screen's re-commit swallows
  // POP's opening exactly like PUSH's. PUSH only with the settle gate on, which
  // moves that mount weight into the hold so the release is light enough for
  // the fixed head to cover the opening.
  const forceCompiled =
    !blink && touch && (status === "POPPING" || (status === "PUSHING" && readSettleGateFlag()));

  const governedHead = touchGoverned || blinkGoverned || forceCompiled;
  const desktopHead = isDesktopMacWebKit() && readDesktopHeadFlag();

  return {
    hasDrivableMotion: !skipAnimation && hasActiveMotion,
    nativeSurgeryAllowed: (transition as { driver?: string }).driver === "native" && !blink,
    touchGoverned,
    forceCompiled,
    governedHead,
    desktopHead,
    birthHoldMs: governedHead
      ? (GOVERNED_HEAD_MS[status] ?? 0)
      : desktopHead
        ? (DESKTOP_HEAD_MS[status] ?? 0)
        : 0,
    governedSlide: touchGoverned && (status === "PUSHING" || status === "POPPING"),
    // Desktop Blink always, and touch Blink only at a genuine high-refresh
    // cadence — a 60Hz phone has nothing to steady.
    framePacingKeepalive:
      hasAnimation &&
      blink &&
      ((typeof navigator !== "undefined" && navigator.maxTouchPoints === 0) ||
        learnedFrameIntervalMs() < COMPILED_TIER_MAX_INTERVAL_MS),
    creepHead: governedHead && readCreepHeadFlag()
  };
};
