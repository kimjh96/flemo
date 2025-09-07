import type { NavigateStatus } from "@navigate/store";
import type { DecoratorName } from "@transition/decorator/typing";
import type {
  PanInfo,
  TargetAndTransition,
  Target,
  AnimationOptions,
  DragControls
} from "motion/react";

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
  value: Target;
  options: AnimationOptions;
};

export type TransitionOptions =
  | {
      decoratorName?: DecoratorName;
      swipeDirection: "x" | "y";
      onSwipeStart: (
        event: MouseEvent | TouchEvent | PointerEvent,
        info: PanInfo,
        options: {
          animate: (target: object, objectTarget: Target, options: AnimationOptions) => void;
          currentScreen: HTMLDivElement;
          prevScreen: HTMLDivElement;
          dragControls: DragControls;
          onStart?: (triggered: boolean) => void;
        }
      ) => Promise<boolean>;
      onSwipe: (
        event: MouseEvent | TouchEvent | PointerEvent,
        info: PanInfo,
        options: {
          animate: (target: object, objectTarget: Target, options: AnimationOptions) => void;
          currentScreen: HTMLDivElement;
          prevScreen: HTMLDivElement;
          dragControls: DragControls;
          onProgress?: (triggered: boolean, progress: number) => void;
        }
      ) => number;
      onSwipeEnd: (
        event: MouseEvent | TouchEvent | PointerEvent,
        info: PanInfo,
        options: {
          animate: (target: object, objectTarget: Target, options: AnimationOptions) => void;
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
