// Core primitives
export { default as TaskManger } from "@core/TaskManger";

// History
export {
  default as createHistoryStore,
  type History,
  type HistoryStore,
  type HistoryStoreApi
} from "@history/store";
export { default as seedInitialHistory } from "@history/seedInitialHistory";
export { default as ensureWindowHistoryState } from "@history/ensureWindowHistoryState";
export { default as seedRouterEntry, type SeedRouterEntryInput } from "@history/seedRouterEntry";
export {
  default as createHistorySync,
  ensureScopeHistorySync,
  releaseScopeHistorySync,
  type HistorySyncDeps
} from "@history/createHistorySync";
export {
  default as createBrowserHistoryDriver,
  type HistoryDriver,
  type HistoryNavEvent
} from "@history/historyDriver";
export { default as createMemoryHistoryDriver } from "@history/memoryHistoryDriver";

// Navigation state
export {
  default as createNavigateStore,
  type NavigateStatus,
  type NavigateStore,
  type NavigateStoreApi
} from "@navigate/store";
export {
  markSelfInducedPop,
  consumeSelfInducedPop,
  createSelfPopGuard,
  type SelfPopGuard
} from "@navigate/selfPopGuard";
export {
  default as createNavigationController,
  type NavigationControllerDeps,
  type DistanceOptions,
  type NavigateOptions,
  type PopOptions
} from "@navigate/createNavigationController";
export {
  default as createStepController,
  readStepParams,
  appendParamsQuery,
  subscribeStepParamsRestore,
  type StepControllerDeps
} from "@navigate/createStepController";

// Router-scope store bundle (one per Router mount; adopted when hosted above).
export {
  default as createRouterScope,
  type FlemoStores,
  type CreateRouterScopeInput
} from "@core/createRouterScope";

// Screen-scoped transition-UI state (drag / replace status + shared-bar registry)
export {
  default as createScreenStore,
  type ScreenStore,
  type ScreenStoreApi,
  type SharedBarPresence,
  type ScreenSurface
} from "@screen/store";
export {
  default as createScreenSelector,
  type ScreenSelection
} from "@screen/createScreenSelector";
export {
  default as computeScreenFreeze,
  type ScreenFreezeInput
} from "@screen/computeScreenFreeze";

// Transition primitives
export { default as createTransition } from "@transition/createTransition";
export { default as createRawTransition } from "@transition/createRawTransition";
export { transitionMap } from "@transition/transition";
export { default as resolveTransition } from "@transition/resolveTransition";
export {
  default as createTransitionStore,
  type TransitionStore,
  type TransitionStoreApi
} from "@transition/store";

// Decorator primitives
export { default as createDecorator } from "@transition/decorator/createDecorator";
export { default as createRawDecorator } from "@transition/decorator/createRawDecorator";
export { decoratorMap } from "@transition/decorator/decorator";

// Bar-transition primitives (progress-driven, name-referenced bar-child animations)
export { default as createPartTransition } from "@transition/partTransition/createPartTransition";
export { default as createRawPartTransition } from "@transition/partTransition/createRawPartTransition";
export { partTransitionMap } from "@transition/partTransition/partTransition";

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
export { default as applyTransitionStyles } from "@transition/applyTransitionStyles";
export { default as registerTransitionDefinitions } from "@transition/registerTransitionDefinitions";
export {
  default as enteringInitialStyle,
  type EnteringInitialStyleInput
} from "@transition/enteringInitialStyle";

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
export {
  createMidFlightCommitLatch,
  type MidFlightCommitLatch
} from "@core/engine/midFlightCommitLatch";
export { default as createSwipeController } from "@core/engine/createSwipeController";
export {
  type SwipeController,
  type SwipeControllerConfig,
  type SwipeControllerElements,
  type SharedBarPresenceLike
} from "@core/engine/createSwipeController";
export { default as computeBarRiding, type BarRidingInput } from "@screen/computeBarRiding";
export {
  animHoldKey,
  shouldMountShellFirst,
  scheduleAnimHoldRelease,
  createAnimHoldCoordinator,
  eagerlyDecodeImages,
  ANIM_HOLD_RELEASE_BACKSTOP_MS,
  type AnimHoldInput,
  type ShellFirstInput,
  type AnimHoldCoordinator
} from "@screen/animStartAnchor";
export { default as observeBarHeight } from "@screen/observeBarHeight";
export { default as observeViewportScrollHeight } from "@screen/observeViewportScrollHeight";

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

// Bar-transition types
export type {
  RegisterPartTransition,
  PartTransitionName,
  PartTransitionOptions,
  PartTransition
} from "@transition/partTransition/typing";

// Pure utils
export { default as isServer } from "@utils/isServer";
export { default as getParams } from "@utils/getParams";
export { default as getMatchedPathPattern } from "@utils/getMatchedPathPattern";
export { default as matchesPathname } from "@utils/matchesPathname";
export { default as isOpaqueColor } from "@utils/isOpaqueColor";
export { default as buildRoutePath } from "@utils/buildRoutePath";
export {
  default as findScrollable,
  overflowsAxis,
  canProgrammaticallyScroll
} from "@utils/findScrollable";
