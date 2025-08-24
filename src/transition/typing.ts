import {
  type PanInfo,
  type TargetAndTransition,
  type Target,
  type AnimationOptions,
  DragControls
} from "motion/react";

import type { NavigateStatus } from "@navigate/store";
import type { DecoratorName } from "@transition/decorator/typing";

// eslint-disable-next-line
export interface RegisterTransition {}

export type TransitionName =
  | RegisterTransition[keyof RegisterTransition]
  | "none"
  | "cupertino"
  | "material";

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
