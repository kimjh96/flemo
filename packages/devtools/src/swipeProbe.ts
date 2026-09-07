import { ACTIVE_ATTR, SCREEN_ATTR, STATUS_ATTR } from "./domProtocol";
import { parseTranslateX } from "./sampling";

// THE SWIPE PROBE: what the RELEASE did to the screens.
//
// A drag is not a flight. The navigate status stays COMPLETED for its whole
// length, so the recorder never opens a window for one and every other probe
// here looks straight past the moment that decides how a swipe feels: the frame
// the finger comes off.
//
// It exists because that moment cost this project a day. A cancelled swipe was
// reported as returning "with no transition at all", and every instrument the
// package had said the flight was clean, because a cancel is not a flight. The
// release clock was right the whole time. What was wrong was the SHAPE: the
// return crossed its last hundred pixels at a dead constant speed and stopped,
// where a landing has to decelerate into rest. A duration is not evidence that
// anything eased, and that is precisely what this reports.
//
// It cannot be sampled at the panel's 3Hz. The defect it is built for is one
// frame wide, so it runs a rAF loop for the length of a settle and then stops.

/** How long after a release the probe keeps watching. Longer than any settle. */
export const SWIPE_PROBE_MS = 1200;

/** Below this the screens were not displaced enough for a release to mean anything. */
const MEANINGFUL_TRAVEL_PX = 2;

/** One screen's pose on one frame after a release. */
export interface SwipeSample {
  /** Milliseconds since the release. */
  readonly t: number;
  /** Each screen's horizontal translate, in document order. */
  readonly x: readonly number[];
  /**
   * The animations found on those screens, as `name|state|ct|rate`. An empty
   * list is the finding, not a gap: nothing was driving the screens that frame.
   */
  readonly animations: readonly string[];
}

export interface SwipeReleaseAudit {
  /** Frames captured from the release onward. */
  readonly samples: readonly SwipeSample[];
  /** How far the furthest screen still had to travel when the finger left. */
  readonly travelAtReleasePx: number;
  /** The largest distance any screen covered between two frames. */
  readonly biggestStepPx: number;
  /** The mean of the first three steps, and of the last three. */
  readonly openingStepPx: number;
  readonly closingStepPx: number;
  /**
   * A landing decelerates: its closing frames are a fraction of its opening
   * ones. A release handed back as a constant rate makes these equal, which is
   * the defect this probe was built for and reads as no transition at all.
   */
  readonly eased: boolean;
  /** A release that put a screen home in one frame. */
  readonly teleported: boolean;
}

const screensNow = (): Element[] => [...document.querySelectorAll(`[${SCREEN_ATTR}]`)];

const poseOf = (element: Element): number =>
  parseTranslateX(getComputedStyle(element).transform ?? "") ?? 0;

const describe = (screens: readonly Element[]): string[] => {
  const found: string[] = [];
  for (const screen of screens) {
    const host = screen as Element & { getAnimations?: () => Animation[] };
    if (typeof host.getAnimations !== "function") continue;
    for (const animation of host.getAnimations()) {
      const named = animation as Animation & { animationName?: string };
      const time = animation.currentTime;
      const ct = typeof time === "number" ? Math.round(time) : 0;
      found.push(
        `${named.animationName ?? "waapi"}|${animation.playState}|ct=${ct}|rate=${animation.playbackRate}`
      );
    }
  }
  return found;
};

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

const round = (value: number) => Math.round(value * 100) / 100;

export interface SwipeProbeOptions {
  /** Called once the watch window closes, with what the release did. */
  readonly onRelease: (audit: SwipeReleaseAudit) => void;
  /** Test seam for the clock. */
  readonly now?: () => number;
  /** Test seam for the frame source. */
  readonly schedule?: (run: () => void) => void;
}

export interface SwipeProbeHandle {
  readonly detach: () => void;
}

/**
 * Watch every pointer release and report what the screens did next.
 *
 * Passive and capture-phase, like the tripwires: it observes the gesture
 * without taking part in it, and its loop starts at the release rather than
 * running all the time.
 */
export const attachSwipeProbe = (options: SwipeProbeOptions): SwipeProbeHandle => {
  /* v8 ignore next -- SSR guard: there is nothing to watch without a document. */
  if (typeof document === "undefined") return { detach: () => {} };

  const now = options.now ?? (() => performance.now());
  const schedule =
    options.schedule ??
    /* v8 ignore next -- the suite always supplies a frame source. */
    ((run: () => void) => {
      requestAnimationFrame(run);
    });

  const onRelease = () => {
    const atRelease = screensNow();
    if (atRelease.length === 0) return;
    const travel = Math.max(...atRelease.map((screen) => Math.abs(poseOf(screen))));
    // Nothing was displaced, so this release had nothing to land.
    if (travel < MEANINGFUL_TRAVEL_PX) return;

    const started = now();
    const samples: SwipeSample[] = [];

    const step = () => {
      const live = screensNow();
      samples.push({
        t: Math.round(now() - started),
        x: live.map((screen) => round(poseOf(screen))),
        animations: describe(live)
      });
      if (now() - started < SWIPE_PROBE_MS) {
        schedule(step);
        return;
      }

      // The furthest-travelling screen is the one the release is about; a
      // parallax partner moves a third as far and would flatten every ratio.
      const lane = samples[0]!.x.reduce(
        (best, value, index) =>
          Math.abs(value) > Math.abs(samples[0]!.x[best] ?? 0) ? index : best,
        0
      );
      const path = samples.map((sample) => sample.x[lane] ?? 0);
      const steps: number[] = [];
      for (let index = 1; index < path.length; index += 1) {
        const covered = Math.abs(path[index]! - path[index - 1]!);
        if (covered > 0) steps.push(covered);
      }
      const opening = mean(steps.slice(0, 3));
      const closing = mean(steps.slice(-3));

      options.onRelease({
        samples,
        travelAtReleasePx: round(travel),
        biggestStepPx: round(Math.max(0, ...steps)),
        openingStepPx: round(opening),
        closingStepPx: round(closing),
        // Half is generous on purpose: this is here to catch a landing that
        // does not slow at all, not to grade a curve.
        eased: steps.length > 3 && closing < opening * 0.5,
        teleported: Math.max(0, ...steps) > travel * 0.5
      });
    };

    schedule(step);
  };

  const types = ["pointerup", "pointercancel"] as const;
  for (const type of types) {
    document.addEventListener(type, onRelease, { capture: true, passive: true });
  }
  return {
    detach: () => {
      for (const type of types) {
        document.removeEventListener(type, onRelease, { capture: true });
      }
    }
  };
};

/** The screens a release is about, for a caller that wants to name them. */
export const releasedScreens = (): { id: string; status: string; active: string }[] =>
  screensNow().map((screen) => ({
    id: screen.getAttribute(SCREEN_ATTR) ?? "",
    status: screen.getAttribute(STATUS_ATTR) ?? "",
    active: screen.getAttribute(ACTIVE_ATTR) ?? ""
  }));
