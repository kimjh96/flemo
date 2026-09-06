import type { NavigateStatus } from "@navigate/store";

import type { AnimationOptions, InitialTarget, TransitionTarget } from "@transition/cssTypes";

import type { DecoratorName } from "@transition/decorator/typing";

// eslint-disable-next-line
export interface RegisterTransition {}

export type TransitionName =
  RegisterTransition[keyof RegisterTransition] | "none" | "cupertino" | "material" | "layout";

export type TransitionVariant = `${NavigateStatus}-${boolean}`;

export type TransitionVariantValue = {
  value: TransitionTarget;
  options: AnimationOptions;
};

// Native pointer-driven swipe info. Mirrors motion's PanInfo shape so
// existing custom transitions need no behavioural rewrite. They just take
// the local SwipeInfo / PointerEvent instead of importing from motion.
export interface SwipeInfo {
  point: { x: number; y: number };
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
  delta: { x: number; y: number };
}

export type SwipeAnimate = (
  target: HTMLElement,
  value: TransitionTarget,
  options?: AnimationOptions
) => Promise<void>;

/**
 * Everything a transition says about its swipe, in one place.
 *
 * WRITING NOTHING BUT A DIRECTION IS A COMPLETE SWIPE. The drag is this
 * transition's own pop keyframes walked by the gesture, the release decides on
 * the distance travelled and the speed at which the finger left, and the
 * landing runs on the clock the controller already computes. The hooks below
 * exist for the drag that is NOT that — a screen that shrinks and is carried
 * about freely, say — and taking one over is what tells flemo to stand aside.
 */
export interface SwipeOptions {
  /**
   * The axis the gesture travels. Required, and deliberately without a
   * default: a stack of pages swipes on x and a sheet on y, both are ordinary,
   * and a silent guess would be wrong half the time. A transition with no
   * swipe leaves `swipe` off altogether.
   */
  direction: "x" | "y";
  /**
   * How far the gesture must carry the screen before the release navigates
   * rather than returning it, in px. A number is that distance; a function is
   * handed the screen's own span so a transition can ask for a fraction of it.
   *
   * The default is the iOS-derived 50px on a 390px screen, expressed as a
   * fraction so it means the same thing on any width.
   *
   * The SPEED half of the same question is not authorable: every preset used
   * the same "or the finger was still moving" floor, so it is the controller's
   * and stays out of the way.
   */
  threshold?: number | ((span: number) => number);
  /**
   * Where the gesture is along its own travel, 0 to 1, per side.
   *
   * The default is geometric: how far the screen has been carried over its own
   * width or height. A drag that resists, eases or clamps says so here, so the
   * FEEL stays the author's while the keyframes stay the transition's.
   *
   * TWO NUMBERS, NOT ONE, because the two sides legitimately walk at different
   * rates. `material` is the case that proves it: the screen being pushed away
   * travels its own height, so its progress keeps growing as the rubber band
   * stretches, while the screen arriving underneath travels 56px and stops
   * there. One scalar cannot say both, and a drag driven by the wrong one is a
   * drag that no longer resists.
   */
  progress?: (info: SwipeInfo, span: number) => number | { active: number; passive: number };
  /**
   * Whether the gesture may begin at all. Returning false abandons it before
   * anything moves.
   */
  onStart?: (
    event: PointerEvent,
    info: SwipeInfo,
    options: {
      animate: SwipeAnimate;
      currentScreen: HTMLDivElement;
      prevScreen: HTMLDivElement;
      onStart?: (triggered: boolean) => void;
    }
  ) => Promise<boolean>;
  /**
   * Move the screens yourself, once per follow frame.
   *
   * TAKING THIS OVER MEANS FLEMO DOES NOT. The screens are yours for the whole
   * drag, so the two of you can never be writing one transform between you —
   * which is what makes a bar drift from the screen it rides. The cost is that
   * the drag is a style write per frame rather than an animation the
   * compositor owns, and the release then has to commit one (see the note on
   * the scrub in createSwipeController for what that measures).
   */
  onMove?: (
    event: PointerEvent,
    info: SwipeInfo,
    options: {
      animate: SwipeAnimate;
      currentScreen: HTMLDivElement;
      prevScreen: HTMLDivElement;
      /**
       * Report the gesture's VERDICT so the decorator and the parts can follow
       * it. The controller supplies their progress itself, against the box the
       * screen is actually dragged over, so a second argument is accepted for
       * source compatibility and is not read.
       */
      onProgress?: (triggered: boolean, progress?: number) => void;
    }
  ) => number;
  /** Land the screens yourself. Taking this over has the same terms as `onMove`. */
  onEnd?: (
    event: PointerEvent,
    info: SwipeInfo,
    options: {
      animate: SwipeAnimate;
      currentScreen: HTMLDivElement;
      prevScreen: HTMLDivElement;
      onStart?: (triggered: boolean) => void;
    }
  ) => Promise<boolean>;
}

/**
 * A transition's non-keyframe options.
 *
 * IT USED TO BE A UNION discriminated on `swipeDirection`, so that the hooks
 * could be required alongside it. Every option added to the swipe then had to
 * be declared absent on the other arm as well (`swipeDirection?: never`) or a
 * caller holding the union could not read it without narrowing first, and the
 * padding grew with the surface. One optional object says the same thing —
 * present is a swipe, absent is not — and says it once.
 */
export type TransitionOptions = {
  decoratorName?: DecoratorName;
  // Opt into CLOCK SURGERY for this transition: "native" lets the engine
  // hold and re-anchor the compiled animation's own clock (first-frame
  // hold, flight-start anchor, stall re-anchoring). The default protects a
  // flight's opening by release SCHEDULING instead and never touches a
  // running animation — on WebKit any such touch costs the accelerated
  // out-of-process path. An author who has glass-verified the trade can
  // take it per transition.
  driver?: "native";
  swipe?: SwipeOptions;

  /**
   * @deprecated Write `swipe: { direction }` instead. Read through
   * `resolveSwipeOptions`, which accepts either shape, so a transition
   * written against this keeps working unchanged.
   */
  swipeDirection?: "x" | "y";
  /** @deprecated Write `swipe: { onStart }` instead. */
  onSwipeStart?: SwipeOptions["onStart"];
  /** @deprecated Write `swipe: { onMove }` instead. */
  onSwipe?: SwipeOptions["onMove"];
  /** @deprecated Write `swipe: { onEnd }` instead. */
  onSwipeEnd?: SwipeOptions["onEnd"];
};

export interface BaseTransition {
  name: TransitionName;
  initial: InitialTarget;
  variants: Record<TransitionVariant, TransitionVariantValue>;
}

export type Transition = BaseTransition & TransitionOptions;
