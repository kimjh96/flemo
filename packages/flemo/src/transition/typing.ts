import type { NavigateStatus } from "@navigate/store";

import type { DecoratorName } from "@transition/decorator/typing";

import type { AnimationOptions, Target, TargetAndTransition } from "motion/react";

// eslint-disable-next-line
export interface RegisterTransition {}

export type TransitionName =
  | RegisterTransition[keyof RegisterTransition]
  | "none"
  | "cupertino"
  | "material"
  | "layout";

export type TransitionVariant = `${NavigateStatus}-${boolean}`;

export type TransitionVariantValue = {
  value: Omit<
    Target,
    | "transitionDuration"
    | "transitionDelay"
    | "transitionTimingFunction"
    | "transitionBehavior"
    | "transitionEnd"
    | "transitionProperty"
  >;
  options: Omit<AnimationOptions, "delay"> & {
    delay?: number;
  };
};

// Native pointer-driven swipe info. Mirrors the shape of motion's PanInfo for
// drop-in compatibility with existing custom transitions, but with no motion
// runtime coupling.
export interface SwipeInfo {
  point: { x: number; y: number };
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
  delta: { x: number; y: number };
}

export type SwipeAnimate = (
  target: HTMLElement,
  value: Target,
  options?: Omit<AnimationOptions, "delay"> & { delay?: number }
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
  initial: TargetAndTransition;
  variants: Record<TransitionVariant, TransitionVariantValue>;
}

export type Transition = BaseTransition & TransitionOptions;
