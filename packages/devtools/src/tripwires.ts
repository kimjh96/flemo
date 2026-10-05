import {
  FLEMO_ANIMATION_PREFIX,
  HEAD_ANIMATION_SUFFIXES,
  STATUS_ATTR,
  TRANSITIONAL_STATUSES
} from "./domProtocol";

import type { InputEvidence, TripwireHit } from "./types";

// TRIPWIRES: the things the recorder is TOLD about.
//
// Everything else in this package samples — three times a second for the panel,
// once a frame for the pacing probe. Sampling is the right shape for a
// question about a span, and the wrong shape for the defects that cost this
// project the most, all of which lasted ONE FRAME:
//
//   * an `animationend` carrying `elapsedTime` 0, which landed a morph before
//     it had moved,
//   * an `animationcancel` from a re-parented participant, after which a
//     negative `animation-delay` overwrote the authored one,
//   * a ghost cut inside a frame of being created (see morphProbe).
//
// A listener cannot miss the frame, and costs nothing on the frames where
// nothing happens. Both listeners are passive and capture-phase, so they
// observe without participating.

/** How long before a transition opens an input event still counts as its cause. */
export const INPUT_WINDOW_MS = 2000;

/** Rolling input events kept; a navigation is never more than a few gestures old. */
const MAX_INPUT_EVENTS = 40;

const round1 = (value: number) => Math.round(value * 10) / 10;

interface InputSample {
  atMs: number;
  trusted: boolean;
  pointerType: string;
}

export interface TripwireHandle {
  detach: () => void;
  /** True once any flemo-named CSS animation event has been observed. */
  sawAnimationEvent: () => boolean;
  /** Input observed in [from - INPUT_WINDOW_MS, to]. */
  inputBetween: (fromMs: number, toMs: number) => InputEvidence;
}

export interface TripwireOptions {
  /**
   * Called with each hit, on the frame it happened. `atMs` is
   * `performance.now()`, absolute — the recorder makes it transition-relative,
   * because a hit can land while no transition is open and must not be silently
   * attributed to the previous one.
   */
  onHit: (
    hit: { kind: TripwireHit["kind"]; detail: string; atMs: number },
    /** The element the event fired on, so the recorder can find its Router. */
    target: EventTarget | null
  ) => void;
  /** Called with the moment the first flemo animation of a transition started. */
  onAnimationStart: (atMs: number, target: EventTarget | null) => void;
}

/**
 * A keyframe name without its head tier: `<name>-deskhead-717ms` and
 * `<name>-deskhead` both read as `<name>`.
 */
export const transitionBaseName = (name: string): string => {
  const untagged = name.replace(/-\d+ms$/, "");
  for (const suffix of HEAD_ANIMATION_SUFFIXES) {
    if (untagged.endsWith(suffix)) return untagged.slice(0, -suffix.length);
  }
  return name;
};

/**
 * How far into its active duration a cancel has to land, after the engine has
 * already resolved the transition, to be the engine's own landing rather than
 * a loss.
 *
 * The engine ends a transition once every channel's remaining motion is below
 * one device pixel (the perceptual cut, see core's perceptualSpan.ts), which
 * removes the still-running animation and cancels it. On the presets that is
 * about 93% in. A transition resolved halfway is not a cut: the 2026-09-23
 * defect flipped COMPLETED 80ms into a 700ms pop, and that must stay loud.
 */
export const LANDING_CUT_MIN_FRACTION = 0.5;

const TRANSITIONAL = new Set<string>(TRANSITIONAL_STATUSES);

const isFlemoAnimation = (event: AnimationEvent): boolean =>
  typeof event.animationName === "string" && event.animationName.startsWith(FLEMO_ANIMATION_PREFIX);

const describe = (target: EventTarget | null): string => {
  if (!(target instanceof Element)) return "an unidentified node";
  const tag = target.tagName.toLowerCase();
  const marker = target.getAttribute("data-flemo-screen") !== null ? " (screen)" : "";
  return `<${tag}>${marker}`;
};

/**
 * Wire the tripwires onto the document.
 *
 * Returns an inert handle where there is no document to wire onto, so a caller
 * never has to branch on the environment.
 */
export const attachTripwires = (options: TripwireOptions): TripwireHandle => {
  if (typeof document === "undefined") {
    return {
      detach: () => {},
      sawAnimationEvent: () => false,
      inputBetween: () => ({ trusted: 0, synthetic: 0, pointerTypes: [] })
    };
  }

  const inputs: InputSample[] = [];
  let sawAnimation = false;
  // Each running flemo animation's active duration, read when it starts: the
  // cancel event carries the time elapsed but not the length it was cut from.
  const durations = new WeakMap<EventTarget, Map<string, number>>();

  const onAnimationStart = (event: AnimationEvent): void => {
    if (!isFlemoAnimation(event)) return;
    sawAnimation = true;
    const target = event.target;
    if (target instanceof Element && typeof target.getAnimations === "function") {
      const animation = target
        .getAnimations()
        .find((running) => (running as CSSAnimation).animationName === event.animationName);
      const active = animation?.effect?.getComputedTiming().activeDuration;
      if (typeof active === "number") {
        const known = durations.get(target) ?? new Map<string, number>();
        known.set(event.animationName, active);
        durations.set(target, known);
      }
    }
    options.onAnimationStart(performance.now(), event.target);
  };

  // A cancel the engine made on purpose, which every transition produces and
  // which is not the loss the tripwire exists for (see cancelResume in core):
  //   a SWAP, where the element already plays the same transition under
  //   another head tier's name (Blink dispatches the cancel a frame later,
  //   so the successor is running by then), and
  //   a LANDING, where the element has already left the transitional statuses
  //   and the animation was cut late in its run.
  const engineOwnedCancel = (event: AnimationEvent): boolean => {
    const target = event.target;
    if (!(target instanceof Element)) return false;
    const base = transitionBaseName(event.animationName);
    const successor =
      typeof target.getAnimations === "function" &&
      target
        .getAnimations()
        .some(
          (running) =>
            transitionBaseName((running as CSSAnimation).animationName ?? "") === base &&
            (running as CSSAnimation).animationName !== event.animationName
        );
    if (successor) return true;
    const status = target.closest(`[${STATUS_ATTR}]`)?.getAttribute(STATUS_ATTR) ?? "";
    const durationMs = durations.get(target)?.get(event.animationName);
    return (
      !TRANSITIONAL.has(status) &&
      durationMs !== undefined &&
      durationMs > 0 &&
      (event.elapsedTime * 1000) / durationMs >= LANDING_CUT_MIN_FRACTION
    );
  };

  const onAnimationCancel = (event: AnimationEvent): void => {
    if (!isFlemoAnimation(event)) return;
    sawAnimation = true;
    if (engineOwnedCancel(event)) return;
    options.onHit(
      {
        kind: "animation-cancel",
        atMs: performance.now(),
        detail:
          `${event.animationName} was CANCELLED on ${describe(event.target)} — the element was ` +
          "re-parented, re-styled or removed mid-transition. A cancelled animation loses its start " +
          "time, and whatever restarts it is free to overwrite the authored delay"
      },
      event.target
    );
  };

  const onAnimationEnd = (event: AnimationEvent): void => {
    if (!isFlemoAnimation(event)) return;
    sawAnimation = true;
    if (event.elapsedTime !== 0) return;
    options.onHit(
      {
        kind: "zero-length-animation-end",
        atMs: performance.now(),
        detail:
          `${event.animationName} reported animationend with elapsedTime 0 on ` +
          `${describe(event.target)} — the animation ended without ever running. Anything ` +
          "that waits for this event runs before the motion it was waiting for"
      },
      event.target
    );
  };

  const onPointer = (event: Event): void => {
    const pointerType = (event as PointerEvent).pointerType ?? "";
    inputs.push({
      atMs: performance.now(),
      trusted: event.isTrusted === true,
      pointerType: pointerType === "" ? event.type : pointerType
    });
    if (inputs.length > MAX_INPUT_EVENTS) inputs.splice(0, inputs.length - MAX_INPUT_EVENTS);
  };

  // Capture phase and passive: the tripwires observe the page, they never take
  // part in it. A non-passive listener on `pointerdown` alone would change what
  // the browser can do with the gesture this library exists to animate.
  const listen = { capture: true, passive: true } as const;
  document.addEventListener("animationstart", onAnimationStart as EventListener, listen);
  document.addEventListener("animationcancel", onAnimationCancel as EventListener, listen);
  document.addEventListener("animationend", onAnimationEnd as EventListener, listen);
  document.addEventListener("pointerdown", onPointer, listen);
  document.addEventListener("click", onPointer, listen);

  return {
    detach: () => {
      document.removeEventListener("animationstart", onAnimationStart as EventListener, listen);
      document.removeEventListener("animationcancel", onAnimationCancel as EventListener, listen);
      document.removeEventListener("animationend", onAnimationEnd as EventListener, listen);
      document.removeEventListener("pointerdown", onPointer, listen);
      document.removeEventListener("click", onPointer, listen);
    },
    sawAnimationEvent: () => sawAnimation,
    inputBetween: (fromMs, toMs) => {
      const from = fromMs - INPUT_WINDOW_MS;
      const seen = inputs.filter((sample) => sample.atMs >= from && sample.atMs <= toMs);
      // Counted rather than branched on, and that is not a style choice: only
      // the browser can set `isTrusted`, so a test environment can never take
      // the trusted arm of an `if` here. A count has no arm to leave untaken,
      // and the number it produces is the same one.
      const trusted = seen.filter((sample) => sample.trusted).length;
      // `pointerType` is never empty: `onPointer` falls back to the event's own
      // type when the browser reports none, and an event type is never blank.
      const pointerTypes = new Set(seen.map((sample) => sample.pointerType));
      return {
        trusted,
        synthetic: seen.length - trusted,
        pointerTypes: [...pointerTypes].sort()
      };
    }
  };
};

export const relativeHit = (
  hit: { kind: TripwireHit["kind"]; detail: string; atMs: number },
  t0Ms: number
): TripwireHit => ({ kind: hit.kind, atMs: round1(hit.atMs - t0Ms), detail: hit.detail });
