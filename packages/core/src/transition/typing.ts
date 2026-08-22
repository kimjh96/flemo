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

export type TransitionOptions =
  | {
      decoratorName?: DecoratorName;
      // Motion-driver override for this transition: "native" pins the
      // compiled-CSS clock, "player" pins the rAF player, replacing the
      // measured kind classification (see core/engine/motionDriverKind).
      driver?: "native" | "player";
      swipeDirection: "x" | "y";
      onSwipeStart: (
        event: PointerEvent,
        info: SwipeInfo,
        options: {
          animate: SwipeAnimate;
          currentScreen: HTMLDivElement;
          prevScreen: HTMLDivElement;
          // `settleSeconds` is the length the transition chose for its
          // release (see swipeSettle). The binding forwards it to the
          // decorator and part hooks so every participant lands on one clock.
          onStart?: (triggered: boolean, settleSeconds?: number) => void;
        }
      ) => Promise<boolean>;
      onSwipe: (
        event: PointerEvent,
        info: SwipeInfo,
        options: {
          animate: SwipeAnimate;
          currentScreen: HTMLDivElement;
          prevScreen: HTMLDivElement;
          onProgress?: (triggered: boolean, progress: number) => void;
        }
      ) => number;
      onSwipeEnd: (
        event: PointerEvent,
        info: SwipeInfo,
        options: {
          animate: SwipeAnimate;
          currentScreen: HTMLDivElement;
          prevScreen: HTMLDivElement;
          // `settleSeconds` is the length the transition chose for its
          // release (see swipeSettle). The binding forwards it to the
          // decorator and part hooks so every participant lands on one clock.
          onStart?: (triggered: boolean, settleSeconds?: number) => void;
        }
      ) => Promise<boolean>;
    }
  | {
      decoratorName?: DecoratorName;
      // See the swipe branch above.
      driver?: "native" | "player";
      swipeDirection?: never;
    };

export interface BaseTransition {
  name: TransitionName;
  initial: InitialTarget;
  variants: Record<TransitionVariant, TransitionVariantValue>;
}

export type Transition = BaseTransition & TransitionOptions;
