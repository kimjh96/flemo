import type { AnimationOptions, TransitionTarget } from "@transition/cssTypes";
import type { BaseTransition, SwipeAnimate, TransitionVariant } from "@transition/typing";

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
    }
  ) => void;
};

// A decorator variant, whose TIMING IS OPTIONAL.
//
// A decorator exists to dress a screen transition — it is reached only through
// that transition's `decoratorName` — so the clock it should run on is already
// decided elsewhere. Omitting `duration` runs this variant on the screen's own
// duration for the SAME variant key, which is what an author matching a dim to
// its transition was writing out by hand.
//
// `ease` is NOT inherited and never will be. `overlay` refuses cupertino's
// curve deliberately: that curve is drawn for position, and spending it on a
// luminance channel front-loads the darkening into a step with a long
// invisible tail. Timing says WHEN a decorator runs; the curve is still the
// decorator author's to draw.
//
// An explicit `duration` still wins, including `0` for a variant that should
// snap and a span longer than the screen's for a dim meant to outlive it.
export type DecoratorVariantValue = {
  value: TransitionTarget;
  options?: AnimationOptions;
};

export interface Decorator extends Omit<BaseTransition, "name" | "variants">, DecoratorOptions {
  name: DecoratorName;
  variants: Record<TransitionVariant, DecoratorVariantValue>;
}
