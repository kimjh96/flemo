import type { BaseTransition } from "@transition/typing";
import type { AnimationOptions, Target } from "motion/react";

// eslint-disable-next-line
export interface RegisterDecorator {}

export type DecoratorName = RegisterDecorator[keyof RegisterDecorator] | "overlay";

export type DecoratorOptions = {
  onSwipeStart?: (
    triggered: boolean,
    options: {
      animate: (target: object, objectTarget: Target, options: AnimationOptions) => void;
      currentDecorator: HTMLDivElement;
      prevDecorator: HTMLDivElement;
    }
  ) => void;
  onSwipe?: (
    triggered: boolean,
    progress: number,
    options: {
      animate: (target: object, objectTarget: Target, options: AnimationOptions) => void;
      currentDecorator: HTMLDivElement;
      prevDecorator: HTMLDivElement;
    }
  ) => void;
  onSwipeEnd?: (
    triggered: boolean,
    options: {
      animate: (target: object, objectTarget: Target, options: AnimationOptions) => void;
      currentDecorator: HTMLDivElement;
      prevDecorator: HTMLDivElement;
    }
  ) => void;
};

export interface Decorator extends Omit<BaseTransition, "name">, DecoratorOptions {
  name: DecoratorName;
}
