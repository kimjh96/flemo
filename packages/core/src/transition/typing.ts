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
      // Opt into CLOCK SURGERY for this transition: "native" lets the engine
      // hold and re-anchor the compiled animation's own clock (first-frame
      // hold, flight-start anchor, stall re-anchoring). The default protects a
      // flight's opening by release SCHEDULING instead and never touches a
      // running animation — on WebKit any such touch costs the accelerated
      // out-of-process path. An author who has glass-verified the trade can
      // take it per transition.
      driver?: "native";
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
          /**
           * Report the gesture's VERDICT so the decorator and the parts can
           * follow it. The controller supplies their progress itself, against
           * the box the screen is actually dragged over, so a second argument
           * is accepted for source compatibility and is not read.
           *
           * It used to be. A transition's own progress is in the transition's
           * own unit — material's is a pull in pixels, layout's is a constant
           * — so what reached a decorator depended on which preset it was
           * paired with, and could not honour the 0-100 those hooks document.
           */
          onProgress?: (triggered: boolean, progress?: number) => void;
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
      // See the swipe branch above.
      driver?: "native";
      swipeDirection?: never;
    };

export interface BaseTransition {
  name: TransitionName;
  initial: InitialTarget;
  variants: Record<TransitionVariant, TransitionVariantValue>;
}

export type Transition = BaseTransition & TransitionOptions;
