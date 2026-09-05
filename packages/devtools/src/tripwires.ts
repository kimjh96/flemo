import { FLEMO_ANIMATION_PREFIX } from "./domProtocol";

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

/** How long before a flight opens an input event still counts as its cause. */
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
   * `performance.now()`, absolute — the recorder makes it flight-relative,
   * because a hit can land while no flight is open and must not be silently
   * attributed to the previous one.
   */
  onHit: (hit: { kind: TripwireHit["kind"]; detail: string; atMs: number }) => void;
  /** Called with the moment the first flemo animation of a flight started. */
  onAnimationStart: (atMs: number) => void;
}

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

  const onAnimationStart = (event: AnimationEvent): void => {
    if (!isFlemoAnimation(event)) return;
    sawAnimation = true;
    options.onAnimationStart(performance.now());
  };

  const onAnimationCancel = (event: AnimationEvent): void => {
    if (!isFlemoAnimation(event)) return;
    sawAnimation = true;
    options.onHit({
      kind: "animation-cancel",
      atMs: performance.now(),
      detail:
        `${event.animationName} was CANCELLED on ${describe(event.target)} — the element was ` +
        "re-parented, re-styled or removed mid-flight. A cancelled animation loses its start " +
        "time, and whatever restarts it is free to overwrite the authored delay"
    });
  };

  const onAnimationEnd = (event: AnimationEvent): void => {
    if (!isFlemoAnimation(event)) return;
    sawAnimation = true;
    if (event.elapsedTime !== 0) return;
    options.onHit({
      kind: "zero-length-animation-end",
      atMs: performance.now(),
      detail:
        `${event.animationName} reported animationend with elapsedTime 0 on ` +
        `${describe(event.target)} — the animation ended without ever running. Anything ` +
        "landing on this event lands before the motion it was waiting for"
    });
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
      const pointerTypes = new Set<string>();
      let trusted = 0;
      let synthetic = 0;
      for (const sample of seen) {
        if (sample.trusted) trusted += 1;
        else synthetic += 1;
        if (sample.pointerType !== "") pointerTypes.add(sample.pointerType);
      }
      return { trusted, synthetic, pointerTypes: [...pointerTypes].sort() };
    }
  };
};

export const relativeHit = (
  hit: { kind: TripwireHit["kind"]; detail: string; atMs: number },
  t0Ms: number
): TripwireHit => ({ kind: hit.kind, atMs: round1(hit.atMs - t0Ms), detail: hit.detail });
