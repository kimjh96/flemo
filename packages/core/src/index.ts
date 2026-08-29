// Core primitives
// `TaskManger` is the historical (misspelled) name — kept for compatibility;
// `TaskManager` is the same singleton under the correct spelling. New code
// should import `TaskManager`.
export { default as TaskManger, default as TaskManager } from "@core/TaskManger";

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
export { default as commitScopeBack } from "@navigate/commitScopeBack";
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
  type SharedBarId,
  type SharedBarMetadata,
  type SharedBarsMetadata,
  type ScreenSurface
} from "@screen/store";
export {
  default as createScreenSelector,
  type ScreenSelection
} from "@screen/createScreenSelector";
export {
  default as computeScreenFreeze,
  computeScreenFreezeMode,
  type ScreenFreezeInput,
  type ScreenFreezeMode
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
export { resolveDecoratorClock } from "@transition/decorator/resolveDecoratorClock";

// Bar-transition primitives (progress-driven, name-referenced bar-child animations)
export { default as createPartTransition } from "@transition/partTransition/createPartTransition";
export { default as createRawPartTransition } from "@transition/partTransition/createRawPartTransition";
export { partTransitionMap } from "@transition/partTransition/partTransition";

// Morph primitives (shared elements: one thing on two screens, under one
// `layoutId`). Authored exactly like every other flemo transition; the travel
// between the two rects is measured per flight and composed by the runtime.
export { default as createMorphTransition } from "@transition/morphTransition/createMorphTransition";
export { default as createRawMorphTransition } from "@transition/morphTransition/createRawMorphTransition";
export { morphTransitionMap } from "@transition/morphTransition/morphTransition";
export { DEFAULT_MORPH_TRANSITION_NAME } from "@transition/morphTransition/typing";

// THE MORPH RUNTIME. A binding registers an element and its `layoutId` before
// paint; everything else — pairing, geometry, keyframes, cleanup — happens
// here, off the DOM protocol, with no framework in sight. See @morph.
export { default as attachMorph, type AttachMorphOptions } from "@morph/attachMorph";
// The flight layer a scope stages its shared elements in. Published by the
// binding because only a Router knows which box bounds its screens.
export { registerMorphLayer } from "@morph/morphLayer";

// THE INTERACTIVE MORPH. A gesture stages its own flights and moves them by
// hand — the shared element follows the finger instead of running a clock — and
// hands them back to the browser on release. A binding wires this to its swipe
// controller once; no transition has to author anything for its morphs to
// become draggable.
export { beginMorphSwipe, type MorphSwipe } from "@morph/morphSwipe";

// Built-in presets
export { default as cupertino } from "@transition/cupertino";
export { default as material } from "@transition/material";
export { default as layout } from "@transition/layout";
export { default as none } from "@transition/none";
export { default as overlay } from "@transition/decorator/overlay";
export { default as shared } from "@transition/morphTransition/shared";
export { default as textMorph } from "@transition/morphTransition/text";
export { default as zoomMorph } from "@transition/morphTransition/zoom";

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
export { governedCompiledActive } from "@platform/governedCompiled";
// The `flemo:*` diagnostic-flag registry (see the module's header table).
// Only the readers a binding consumes are public: the render-settle gate
// (shared with the engine's routing so both sides always agree), the
// desktop-Safari atomic release flip, the pre-raster probe, its
// layer-promotion half (hydration-deferred by the binding — see the reader's
// SSR contract), and the image-offloader override.
// THE AMBIENT RUNTIME: the machinery an app sits in so the FIRST navigation is
// not the one that pays for it — GPU pipelines compiled, oversized decodes off
// the main thread, the compositor awake while the user is about to move. A
// binding starts it per Router mount and releases on unmount; repeat calls
// share one runtime. See @runtime/flemoRuntime.
export { startFlemoRuntime } from "@runtime/flemoRuntime";

// THE PLATFORM PROFILE: every per-browser decision, resolved in one place.
// A binding asks for the profile and renders the answer; it never re-derives
// policy from the probes and flag readers itself (see @platform/profile).
export {
  resolvePlatformProfile,
  restLayerPromotionEnabled,
  type PlatformProfile,
  type PlatformProfileInput
} from "@platform/profile";
// The DOM PROTOCOL: every `data-flemo-*` attribute the library writes, and the
// values the animation hold takes. This is the real interface between the
// packages — a binding renders these, the compiled stylesheet selects on them,
// and @flemo/devtools observes them. See @dom/attributes for the table.
export {
  FLEMO_ATTR_PREFIX,
  FLEMO_ATTRIBUTES,
  attrSelector,
  attrValueSelector,
  ANIM_HOLD,
  ANIM_HOLD_ATTR,
  ANIM_HOLD_PAUSED_VALUES,
  ACTIVE_ATTR,
  BAR_ACTIVE_ATTR,
  BAR_ATTR,
  BAR_ID_ATTR,
  BAR_ID_TYPE_ATTR,
  BAR_RIDING_ATTR,
  BAR_SPACER_ATTR,
  BAR_STATUS_ATTR,
  BAR_TRANSITION_ATTR,
  CREEP_ATTR,
  DECORATOR_ATTR,
  DECORATOR_NAME_ATTR,
  DESK_HEAD_ATTR,
  DEVTOOLS_PANEL_ATTR,
  GOVERNED_ATTR,
  GPU_PREWARM_ATTR,
  HELD_ARRIVAL_ATTR,
  IMAGE_HOLD_ATTR,
  LAYER_HOST_ATTR,
  LAYER_OWNER_ATTR,
  LAYER_SLOT_ATTR,
  MORPH_ATTR,
  MORPH_LAYER_ATTR,
  MORPH_NAME_ATTR,
  MORPH_ROLE,
  MORPH_SLOT_ATTR,
  MORPH_SHEET_ATTR,
  PART_NAME_ATTR,
  ROUTER_ATTR,
  SCREEN_ATTR,
  STATUS_ATTR,
  TRANSITION_ATTR,
  WARM_ATTR,
  WARM_VIDEO_ATTR
} from "@dom/attributes";
// The STACKING CONTRACT a screen keeps inside its own box: content under its
// chrome, chrome under an overlay that exists to cover it, and the dim over
// all three. See @dom/stacking.
export { OVERLAY_LEVEL, SCREEN_STACKING_ORDER, UNNUMBERED_LEVEL } from "@dom/stacking";
// The `flemo:*` DIAGNOSTIC-FLAG REGISTRY: what each storage key is, what it
// defaults to, and which keys are retired residue. Exported so a report or a
// panel enumerates the flags the library actually reads instead of a copy that
// drifts from it. See @core/engine/diagnosticRegistry.
export {
  DIAGNOSTIC_FLAGS,
  RETIRED_DIAGNOSTIC_FLAGS,
  type DiagnosticFlag,
  type DiagnosticFlagKind,
  type RetiredDiagnosticFlag
} from "@core/engine/diagnosticRegistry";
export { TRANSITIONAL_STATUS_VALUES } from "@navigate/store";
export {
  SKIP_ANIMATION_ATTR,
  type TransitionEngine,
  type TransitionEngineDeps,
  type ScreenLifecycleInput
} from "@core/engine/types";
export { default as createSwipeController } from "@core/engine/createSwipeController";
export {
  type SwipeController,
  type SwipeControllerConfig,
  type SwipeControllerElements,
  type SharedBarPresenceLike
} from "@core/engine/createSwipeController";
export {
  default as computeBarRiding,
  sharedBarsMatch,
  type BarRidingInput
} from "@screen/computeBarRiding";
export {
  animHoldKey,
  scheduleAnimHoldRelease,
  createAnimHoldCoordinator,
  eagerlyDecodeImages,
  ANIM_HOLD_RELEASE_BACKSTOP_MS,
  type AnimHoldInput,
  type AnimHoldCoordinator
} from "@screen/animStartAnchor";
// Engine probe (Blink vs everything else). Public for bindings whose release
// policy branches per engine — the entry content-settle gate runs only where
// the compiled (untouched) animation is the driver (non-Blink).
export { detectBlinkEngine, isDesktopBlink, isLegacyAndroidBlink } from "@platform/engineProbes";
// Steady-60 desktop session predicate (see steadySixtyCadence.ts). What still
// keys on it is the compositor warm-up's cadence lock, which is a claim about
// the panel's rate; the desktop defaults that are about Blink's layer handling
// or a desktop's memory read `isDesktopBlink` instead.
export { steadySixtyDesktopProfile } from "@platform/steadySixtyCadence";
export {
  swipeSettleSeconds,
  MIN_SETTLE_SECONDS,
  type SwipeSettleInput
} from "@transition/swipeSettle";

export { default as observeBarHeight } from "@screen/observeBarHeight";
export { default as publishRideBox } from "@screen/publishRideBox";
export {
  percentRatio,
  resolveRideTarget,
  rideLength,
  RIDE_HEIGHT_VAR
} from "@transition/rideOffset";
export { default as observeViewportScrollHeight } from "@screen/observeViewportScrollHeight";

// Compositor warm-up (see the module): also pre-armed by the React binding on
// pointerdown, so a tap's flight starts on an already-spinning compositor.
export { default as holdCompositorWarm } from "@core/engine/compositorWarmUp";

// One-shot GPU pipeline prewarm (see the module): front-loads Graphite/Dawn
// pipeline compilation at boot idle so a cold cache's ~100ms GPU stalls never
// land inside the first flight.
export { default as ensureGpuPipelinePrewarm } from "@core/engine/gpuPipelinePrewarm";

// Off-main decode-to-scale for oversized images (WebKit decodes synchronously
// on the main thread at full source resolution, recurringly; see the module).
export {
  default as ensureImageDecodeOffloader,
  createImageDecodeOffloader,
  shouldOffloadImage,
  OVERSIZE_AREA_RATIO,
  OFFLOADED_SRC_ATTR,
  type OversizeInput
} from "@core/engine/imageDecodeOffloader";

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

// Morph types
export type {
  RegisterMorphTransition,
  MorphTransitionName,
  MorphTransitionOptions,
  MorphTransition
} from "@transition/morphTransition/typing";

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
