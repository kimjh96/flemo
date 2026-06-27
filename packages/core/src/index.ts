// Core primitives
export { default as TaskManger } from "@core/TaskManger";

// History
export {
  default as createHistoryStore,
  type History,
  type HistoryStore,
  type HistoryStoreApi
} from "@history/store";

// Navigation state
export {
  default as createNavigateStore,
  type NavigateStatus,
  type NavigateStore,
  type NavigateStoreApi
} from "@navigate/store";
export { markSelfInducedPop, consumeSelfInducedPop } from "@navigate/selfPopGuard";

// Transition primitives
export { default as createTransition } from "@transition/createTransition";
export { default as createRawTransition } from "@transition/createRawTransition";
export { transitionMap } from "@transition/transition";
export {
  default as createTransitionStore,
  type TransitionStore,
  type TransitionStoreApi
} from "@transition/store";

// Decorator primitives
export { default as createDecorator } from "@transition/decorator/createDecorator";
export { default as createRawDecorator } from "@transition/decorator/createRawDecorator";
export { decoratorMap } from "@transition/decorator/decorator";

// Built-in presets
export { default as cupertino } from "@transition/cupertino";
export { default as material } from "@transition/material";
export { default as layout } from "@transition/layout";
export { default as none } from "@transition/none";
export { default as overlay } from "@transition/decorator/overlay";

// Style compiler
export {
  compileTransitionStyles,
  animationName,
  variantHasAnimation,
  targetToDecls,
  collectAnimatedProperties,
  easingToCss,
  type CssDecl
} from "@transition/compileTransitionStyles";

// Imperative swipe driver (framework-agnostic DOM helper). Mutates inline
// styles during a drag; the runtime engine and custom transitions consume it.
export { default as animateInline, clearInlineAnimation } from "@transition/animateInline";

// Framework-neutral transition engine. Owns the navigation-task lifecycle and
// cleanup for a screen; bindings feed it plain DOM elements + state.
export { default as createTransitionEngine } from "@core/engine/createTransitionEngine";
export {
  SKIP_ANIMATION_ATTR,
  type TransitionEngine,
  type TransitionEngineDeps,
  type ScreenLifecycleInput
} from "@core/engine/types";

// Transition types
export type {
  RegisterTransition,
  TransitionName,
  TransitionVariant,
  TransitionVariantValue,
  TransitionOptions,
  BaseTransition,
  Transition,
  SwipeInfo,
  SwipeAnimate
} from "@transition/typing";

// Decorator types
export type {
  RegisterDecorator,
  DecoratorName,
  DecoratorOptions,
  Decorator
} from "@transition/decorator/typing";

// Pure utils
export { default as isServer } from "@utils/isServer";
export { default as getParams } from "@utils/getParams";
export { default as getMatchedPathPattern } from "@utils/getMatchedPathPattern";
export {
  default as findScrollable,
  overflowsAxis,
  canProgrammaticallyScroll
} from "@utils/findScrollable";
