import type { BaseTransition, SwipeAnimate } from "@transition/typing";

// eslint-disable-next-line
export interface RegisterDecorator {}

export type DecoratorName = RegisterDecorator[keyof RegisterDecorator] | "overlay";

export type DecoratorOptions = {
  onSwipeStart?: (
    triggered: boolean,
    options: {
      animate: SwipeAnimate;
      currentDecorator: HTMLDivElement;
      prevDecorator: HTMLDivElement;
    }
  ) => void;
  onSwipe?: (
    triggered: boolean,
    progress: number,
    options: {
      animate: SwipeAnimate;
      currentDecorator: HTMLDivElement;
      prevDecorator: HTMLDivElement;
    }
  ) => void;
  onSwipeEnd?: (
    triggered: boolean,
    options: {
      animate: SwipeAnimate;
      currentDecorator: HTMLDivElement;
      prevDecorator: HTMLDivElement;
      // The length the transition chose for this release, so the decorator
      // lands with the screens instead of on a clock of its own. Absent when
      // the transition does not report one.
      settleSeconds?: number;
    }
  ) => void;
};

export interface Decorator extends Omit<BaseTransition, "name">, DecoratorOptions {
  name: DecoratorName;
}
