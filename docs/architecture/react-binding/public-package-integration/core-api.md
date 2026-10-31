# Core APIs and binding integration

The supplied `packages/core/src/index.ts` establishes export availability, not verification of the exported implementations.

## Import boundary

Import public APIs from `@flemo/core`; the barrel's internal aliases are implementation locations, not consumer import paths. See [ownership and protocol](../ownership-and-protocol.md) for binding responsibilities.

`TaskManager` and the historical misspelling `TaskManger` re-export the same default from `@core/TaskManager`. Use `TaskManager` in new code; `TaskManger` remains available for compatibility.

| Area | Exported entrypoints |
| --- | --- |
| History | `createHistoryStore`, `seedInitialHistory`, `ensureWindowHistoryState`, `seedRouterEntry`, `createHistorySync`, `ensureScopeHistorySync`, `releaseScopeHistorySync`, `createBrowserHistoryDriver`, `createMemoryHistoryDriver` |
| Navigation | `createNavigateStore`, `markSelfInducedPop`, `consumeSelfInducedPop`, `createSelfPopGuard`, `createNavigationController` |
| Step navigation | `createStepController`, `readStepParams`, `appendParamsQuery`, `subscribeStepParamsRestore` |
| Router and screen state | `createRouterScope`, `adoptEntryIdentity`, `createScreenStore`, `createScreenSelector`, `computeScreenFreeze`, `computeScreenFreezeMode` |
| Transition definitions | `createTransition`, `createRawTransition`, `transitionMap`, `resolveTransition`, `createTransitionStore` |
| Decorator definitions | `createDecorator`, `createRawDecorator`, `decoratorMap`, `resolveDecoratorTiming` |
| Part definitions | `createPartTransition`, `createRawPartTransition`, `partTransitionMap` |
| Morph definitions | `createMorphTransition`, `createRawMorphTransition`, `morphTransitionMap`, `DEFAULT_MORPH_TRANSITION_NAME` |
| Presets | `cupertino`, `material`, `layout`, `none`, `overlay`, `shared`, `textMorph`, `zoomMorph` |

Associated store, controller, history, transition, registration, option, and lifecycle types are also exported, including the types `SwipeOptions` and `SwipeStop`. Use `import type` for type-only contracts.

## Styles and binding integration

| Area | Exports |
| --- | --- |
| Styles | `compileTransitionStyles`, `applyTransitionStyles`, `registerTransitionDefinitions`, `enteringInitialStyle` |
| Compiler helpers | `animationName`, `variantHasAnimation`, `targetToDecls`, `collectAnimatedProperties`, `easingToCss`, `HEAD_ANIMATION_SUFFIXES`, type `CssDecl` |
| Imperative animation | `animateInline`, `clearInlineAnimation` |
| Engine and swipe | `createTransitionEngine` and its lifecycle types; `createSwipeController` and its configuration and element types |
| Shared elements | `attachMorph`, `AttachMorphOptions`, `registerMorphLayer`, `beginMorphSwipe`, `MorphSwipe` |
| Part layers | `registerPartLayer`, `resolvePartLayer` |
| Holds and shared bars | `animHoldKey`, `scheduleAnimHoldRelease`, `createAnimHoldCoordinator`, `eagerlyDecodeImages`, `ANIM_HOLD_RELEASE_BACKSTOP_MS`, `computeBarRiding`, `sharedBarsMatch` |
| Measurement and geometry | `observeBarHeight`, `readBarHeight`, `publishRideBox`, `percentRatio`, `resolveRideTarget`, `rideLength`, `RIDE_HEIGHT_VAR`, `observeViewportScrollHeight` |
| Swipe options and settlement | `resolveSwipeOptions`, `DEFAULT_COMMIT_FRACTION`, `DEFAULT_COMMIT_VELOCITY`, `swipeSettleSeconds`, `MIN_SETTLE_SECONDS`, and associated input and result types |

These declarations establish public core access, not public React component exports. The barrel does not contain the swipe constants' numeric values or settlement algorithms.

## Runtime and platform

`startFlemoRuntime` is public. Its source comment describes shared ambient machinery started for a Router mount and released on unmount. Lower-level exports include `ensureGpuPipelinePrewarm`, `ensureImageDecodeOffloader`, `createImageDecodeOffloader`, `shouldOffloadImage`, and `OVERSIZE_AREA_RATIO`.

`resolvePlatformProfile`, `PlatformProfile`, and `PlatformProfileInput` provide the binding's policy interface. The barrel also exposes `governedCompiledActive`, `detectBlinkEngine`, `isDesktopBlink`, `isLegacyAndroidBlink`, and `steadySixtyDesktopProfile`. Their availability does not supersede the canonical instruction to resolve named profile decisions rather than re-derive browser policy in the binding. Barrel comments alone do not establish current routing defaults.

## DOM protocol and utilities

Protocol exports include `FLEMO_ATTR_PREFIX`, `FLEMO_ATTRIBUTES`, `attrSelector`, `attrValueSelector`, hold names and paused values, and selected screen, bar, decorator, layer, morph, Part, Router, runtime, and tooling constants. `SKIP_ANIMATION_ATTR` is exported through engine types. Declaration in the attribute module does not automatically establish export from the public barrel; these are separate boundaries.

Stacking exports are `OVERLAY_LEVEL`, `SCREEN_STACKING_ORDER`, and `UNNUMBERED_LEVEL`. `TRANSITIONAL_STATUS_VALUES` is also public. See [binding lifecycle and DOM protocol](../../motion-engine/binding-lifecycle-and-dom-protocol.md) for ownership contracts.

Utility exports are `isServer`, `getParams`, `getMatchedPathPattern`, `matchesPathname`, `isOpaqueColor`, `buildRoutePath`, `findScrollable`, `overflowsAxis`, and `canProgrammaticallyScroll`.
