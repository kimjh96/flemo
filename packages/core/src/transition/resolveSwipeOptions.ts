import type { SwipeInfo, SwipeOptions, Transition } from "@transition/typing";

/**
 * The swipe a transition declares, with its defaults filled in.
 *
 * A transition states as little as `{ direction }` and every caller downstream
 * needs a complete answer: how far to commit, how fast, where the two sides
 * are. Resolving that at each call site is how the defaults drift, so it
 * happens once, here, and "a direction is a complete swipe" is a fact about
 * this function rather than a promise made in a doc comment.
 */
export interface ResolvedSwipe {
  direction: "x" | "y";
  /** How far the gesture must carry the screen to navigate, in px. */
  commitDistance: (span: number) => number;
  /** How fast the finger must still be going to navigate regardless. */
  commitVelocity: number;
  /** Where the two sides are along their travel, 0 to 1. */
  progress: (
    info: SwipeInfo,
    span: number,
    travelled: number
  ) => { active: number; passive: number };
  onStart: SwipeOptions["onStart"] | undefined;
  onMove: SwipeOptions["onMove"] | undefined;
  onEnd: SwipeOptions["onEnd"] | undefined;
  /**
   * Whether flemo drives the screens itself.
   *
   * A transition that took over `onMove` or `onEnd` owns the screens for that
   * gesture, and flemo does not stage a scrub for them: two drivers on one
   * transform is exactly how a bar drifts from the screen it rides. `onStart`
   * only answers whether the gesture may begin, so it costs nothing.
   */
  drivesScreens: boolean;
}

/**
 * The distance at which a release navigates, as a fraction of the screen's own
 * span.
 *
 * 50px on the 390px screen it was chosen on — the number cupertino carried
 * before this was shared — expressed as a fraction so a wider screen asks for
 * proportionally more rather than the same 50px.
 */
export const DEFAULT_COMMIT_FRACTION = 50 / 390;

/**
 * The speed at which a release navigates however little it travelled, unless
 * the transition names its own.
 *
 * 20 is what all three presets had written for themselves, and it is their
 * taste rather than a law: a consumer transition asks for 300, a fifteen times
 * harder flick. Without a way to name it, a declarative drag that wanted a
 * different number would have to take over `onEnd` and give up the scrub for
 * it.
 */
export const DEFAULT_COMMIT_VELOCITY = 20;

/**
 * Into 0-1, with NaN read as the start rather than as a hole.
 *
 * Only NaN needs naming: the clamp handles both infinities on its own, and a
 * transition whose resistance curve divides by a box that has not been laid
 * out yet produces NaN, which would otherwise be scrubbed into a compiled
 * animation as an undefined time.
 */
const clamp01 = (value: number): number =>
  Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value));

export const resolveSwipeOptions = (transition: Transition): ResolvedSwipe | null => {
  const swipe = transition.swipe;
  if (!swipe) return null;

  const { direction, onStart, onMove, onEnd } = swipe;

  const threshold = swipe.threshold;
  const commitDistance =
    typeof threshold === "function"
      ? threshold
      : typeof threshold === "number"
        ? () => threshold
        : (span: number) => span * DEFAULT_COMMIT_FRACTION;

  const declared = swipe.progress;
  const progress = (info: SwipeInfo, span: number, travelled: number) => {
    const geometric = span > 0 ? travelled / span : 0;
    const reported = declared?.(info, span);
    const pair =
      typeof reported === "number"
        ? { active: reported, passive: reported }
        : (reported ?? { active: geometric, passive: geometric });
    return { active: clamp01(pair.active), passive: clamp01(pair.passive) };
  };

  return {
    direction,
    commitDistance,
    commitVelocity: swipe.velocity ?? DEFAULT_COMMIT_VELOCITY,
    progress,
    onStart,
    onMove,
    onEnd,
    drivesScreens: !onMove && !onEnd
  };
};

export default resolveSwipeOptions;
