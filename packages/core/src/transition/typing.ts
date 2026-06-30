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
      swipeDirection: "x" | "y";
      onSwipeStart: (
        event: PointerEvent,
        info: SwipeInfo,
        options: {
          animate: SwipeAnimate;
          currentScreen: HTMLDivElement;
          prevScreen: HTMLDivElement;
          onStart?: (triggered: boolean) => void;
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
          onStart?: (triggered: boolean) => void;
        }
      ) => Promise<boolean>;
    }
  | {
      decoratorName?: DecoratorName;
      swipeDirection?: never;
    };

export interface BaseTransition {
  name: TransitionName;
  initial: InitialTarget;
  variants: Record<TransitionVariant, TransitionVariantValue>;
}

export type Transition = BaseTransition & TransitionOptions;
