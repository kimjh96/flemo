import { DESKTOP_HEAD_MS, GOVERNED_HEAD_MS } from "@transition/compileTransitionStyles";

import type { Transition } from "@transition/typing";

import { learnedFrameIntervalMs } from "@platform/displayCadence";
import { COMPILED_TIER_MAX_INTERVAL_MS } from "@platform/displayProbe";
import {
  detectBlinkEngine,
  isDesktopBlink,
  isDesktopMacWebKit,
  isLegacyAndroidBlink
} from "@platform/engineProbes";
import { governedCompiledActive } from "@platform/governedCompiled";
import { settleGateActive } from "@platform/profile";
import { learnedReleaseLatencyMs } from "@platform/releaseLatency";

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
// Read once per drive run, never cached: the probes feeding it are read live,
// so a verdict formed mid-session lands on the next navigation.

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

  /** Arm the creep head beside the governed one. */
  readonly creepHead: boolean;

  /**
   * How many vsyncs a CLEAN end waits before the COMPLETED flip, so the
   * motion's last frame reaches the glass before the flip's commit can cut it.
   *
   * The number is a property of WHO DRAWS THE FRAME, not a safety margin to be
   * padded. See `landingClearFrames`.
   */
  readonly landingClearFrames: number;
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

// HOW MANY VSYNCS A CLEAN END WAITS BEFORE THE COMPLETED FLIP.
//
// The flip's commit is the convergence frame's busiest moment — the status
// re-render, the covered screen's teardown, the compiled animations coming off
// every participant at once — and running it in the same beat as the motion's
// last frame measured as a dropped frame right at the landing. So the last
// frame is given room to PRESENT first. The question this answers is how much
// room, and the answer is a property of WHO DRAWS THE FRAME.
//
// BLINK DRAWS FROM THE COMPOSITOR THREAD. The last motion frame is committed
// in the main frame that ends the animation and drawn at that same frame's
// deadline, so by the next vsync it is already on glass and nothing the main
// thread does afterwards can take it back. ONE frame is the whole cover, and
// it is a real one: traced over twelve pops with no frames at all, two of them
// lost the last motion frame to the flip's commit.
//
// WEBKIT PRESENTS FROM THE MAIN THREAD, one to two frames behind its own
// commit, so a flip landing at commit+2 still cut the decel tail's final frame
// on device (the "blip at the end" of a pop). Four puts the flip past that
// pipeline, and stays until a device says otherwise.
//
// A COVER LONGER THAN THE PIPELINE IS NOT FREE, which is what four frames
// everywhere was costing. It reads as free — the screen holds its arrival pose
// under the compiled rules, so the extra frames are stillness. They are
// stillness that ENDS IN A CHANGE: the flip is what takes the compiled
// animations off, and every element that was composited to run one is
// re-rastered the moment it goes. Traced on desktop Chrome over twelve pops of
// the composition bench, twelve of twelve held the last motion frame for 50ms
// and then repainted — the arriving screen's title and card copy visibly
// changing weight as their text went back from the layer's grayscale
// antialiasing to the document's subpixel antialiasing. That is the "hitch at
// the end of the transition" the bench has been reported as having. At one
// frame the same twelve pops presented on every vsync and the repaint rode the
// frame straight after the motion, where it reads as the motion settling.
export const landingClearFrames = (): number => (detectBlinkEngine() ? 1 : 4);

/**
 * WHICH HEAD KIT this session plays, and how long its flat head is.
 *
 * Extracted so it has exactly one definition. It is a pure function of the
 * platform and the status — nothing about the flight —
 * and the MORPH runtime needs the same answer at a moment when it cannot get
 * it from the DOM: the head is announced by an attribute on the root, and the
 * engine writes that attribute from the SAME commit the morph is staged in.
 * React runs a descendant's layout effect first, so a morph reading the
 * attribute reads the PREVIOUS flight's answer — right by luck from the second
 * navigation on, and wrong on the first, which is what made a first push run
 * its element 33ms ahead of the screen carrying it while every push after it
 * was aligned.
 */
export const resolveHeadKit = (
  status: string
): {
  touchGoverned: boolean;
  forceCompiled: boolean;
  governedHead: boolean;
  desktopHead: boolean;
  headMs: number;
} => {
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
  const blinkGoverned = blink && touch && isLegacyAndroidBlink();

  // POP always: device-measured, a heavy returning screen's re-commit swallows
  // POP's opening exactly like PUSH's. PUSH only with the settle gate on, which
  // moves that mount weight into the hold so the release is light enough for
  // the fixed head to cover the opening.
  const forceCompiled =
    !blink && touch && (status === "POPPING" || (status === "PUSHING" && settleGateActive()));

  const governedHead = touchGoverned || blinkGoverned || forceCompiled;
  // The desktop flat head, the desktop sibling of the governed head: a compiled
  // clock is born at the release update's style resolution but its first frame
  // reaches the glass only after that update's paint, the compositor commit and
  // the UI process's activation. The head holds the authored from-pose across
  // that latency so the curve PLAYS from 0 instead of being entered partway.
  //
  // DESKTOP BLINK TOO, WHERE THERE IS A LATENCY TO COVER. It was left out on
  // the reading that the latency belonged to WebKit's main-thread presentation,
  // and a desktop Chromium session was assumed to reach glass on the frame it
  // committed. It does not: traced on a 120Hz desktop Chrome, the
  // tap-to-first-painted-frame of a push ran 28.5ms against an 8.3ms frame, of
  // which 22.3ms was the arriving screen's own first render, and the two frames
  // after it ran 17ms each. With no head those land on the animation's opening,
  // so the curve is entered several frames in and the transition starts with a
  // lurch.
  //
  // But a head is a COVER FOR A LATENCY, and a cover for a latency that is not
  // there is dead time — the screen held still after it could already have
  // moved. That number is a property of the app, not of the browser: an app
  // whose screens are already mounted reaches glass in a frame and would be
  // paying twenty milliseconds of stillness for nothing. So the session
  // measures itself (see releaseLatency) and wears the head only while its own
  // opening runs longer than a frame. The first navigation of a status has
  // nothing measured and takes the head, because that is the one most likely to
  // be slow.
  //
  // WebKit keeps the unconditional head it shipped with: its latency is a
  // property of how it presents, which no amount of the app being fast removes.
  const learned = learnedReleaseLatencyMs(status);
  const blinkNeedsHead = learned === null || learned > learnedFrameIntervalMs();
  const desktopHead = isDesktopMacWebKit() || (isDesktopBlink() && blinkNeedsHead);
  return {
    touchGoverned,
    forceCompiled,
    governedHead,
    desktopHead,
    headMs: governedHead
      ? (GOVERNED_HEAD_MS[status] ?? 0)
      : desktopHead
        ? (DESKTOP_HEAD_MS[status] ?? 0)
        : 0
  };
};

export const resolveFlightRouting = (input: FlightRoutingInput): FlightRouting => {
  const { status, transition, skipAnimation, hasActiveMotion, hasAnimation } = input;
  const blink = detectBlinkEngine();

  // One definition of the head kit, shared with the morph runtime — see
  // resolveHeadKit. The two answers must never be able to drift apart: a morph
  // staged against a different kit from the flight carrying it runs its element
  // a head ahead of the screen.
  const { touchGoverned, forceCompiled, governedHead, desktopHead, headMs } =
    resolveHeadKit(status);

  return {
    hasDrivableMotion: !skipAnimation && hasActiveMotion,
    nativeSurgeryAllowed: (transition as { driver?: string }).driver === "native" && !blink,
    touchGoverned,
    forceCompiled,
    governedHead,
    desktopHead,
    birthHoldMs: headMs,
    governedSlide: touchGoverned && (status === "PUSHING" || status === "POPPING"),
    // Desktop Blink always, and touch Blink only at a genuine high-refresh
    // cadence — a 60Hz phone has nothing to steady.
    framePacingKeepalive:
      hasAnimation &&
      blink &&
      ((typeof navigator !== "undefined" && navigator.maxTouchPoints === 0) ||
        learnedFrameIntervalMs() < COMPILED_TIER_MAX_INTERVAL_MS),
    // The CREEP head: its end keyframe carries a translateZ hair instead of
    // repeating the start pose, so the value changes across the head and the
    // compositor is already carrying the animation when the real motion begins.
    // Aimed at the one dropped frame device timelines pinned to the head
    // BOUNDARY (it followed the head length: 100ms head -> 6th frame after
    // release, 200ms -> 12th).
    creepHead: governedHead && governedCompiledActive(),
    landingClearFrames: landingClearFrames()
  };
};
