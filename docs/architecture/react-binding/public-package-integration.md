# Public package and binding integration

This reference describes the supplied `packages/core/src/index.ts` and `packages/react/package.json`. Export declarations establish available names; they do not independently verify the implementations behind those names. The manifest establishes declared package configuration, not publication or packed-artifact validation.

## Core import boundary

Import public core APIs from `@flemo/core`. The barrel's internal alias paths are implementation locations, not consumer import paths. See [ownership and protocol](ownership-and-protocol.md) for the binding's responsibilities.

`TaskManager` and the historical misspelling `TaskManger` re-export the same default from `@core/TaskManager`. New code should use `TaskManager`; the misspelled name remains available for compatibility.

The public surface includes these groups:

| Area | Exported entrypoints |
| --- | --- |
| History | `createHistoryStore`, `seedInitialHistory`, `ensureWindowHistoryState`, `seedRouterEntry`, `createHistorySync`, `ensureScopeHistorySync`, `releaseScopeHistorySync`, `createBrowserHistoryDriver`, and `createMemoryHistoryDriver` |
| Navigation | `createNavigateStore`, `markSelfInducedPop`, `consumeSelfInducedPop`, `createSelfPopGuard`, and `createNavigationController` |
| Step navigation | `createStepController`, `readStepParams`, `appendParamsQuery`, and `subscribeStepParamsRestore` |
| Router and screen state | `createRouterScope`, `adoptEntryIdentity`, `createScreenStore`, `createScreenSelector`, `computeScreenFreeze`, and `computeScreenFreezeMode` |
| Transition definitions | `createTransition`, `createRawTransition`, `transitionMap`, `resolveTransition`, and `createTransitionStore` |
| Decorator definitions | `createDecorator`, `createRawDecorator`, `decoratorMap`, and `resolveDecoratorTiming` |
| Part definitions | `createPartTransition`, `createRawPartTransition`, and `partTransitionMap` |
| Morph definitions | `createMorphTransition`, `createRawMorphTransition`, `morphTransitionMap`, and `DEFAULT_MORPH_TRANSITION_NAME` |
| Presets | `cupertino`, `material`, `layout`, `none`, `overlay`, `shared`, `textMorph`, and `zoomMorph` |

The barrel also exports associated store, controller, history, transition, registration, option, and lifecycle types. It exposes `SwipeOptions` and `SwipeStop` as types. Import type-only contracts with `import type`.

## Styles and binding integration

Style exports include `compileTransitionStyles`, `applyTransitionStyles`, `registerTransitionDefinitions`, and `enteringInitialStyle`. Compiler helpers include `animationName`, `variantHasAnimation`, `targetToDecls`, `collectAnimatedProperties`, `easingToCss`, `HEAD_ANIMATION_SUFFIXES`, and the `CssDecl` type. Imperative animation exports are `animateInline` and `clearInlineAnimation`.

Bindings can import `createTransitionEngine`, its lifecycle types, `createSwipeController`, and its configuration and element types. Shared-element integration exposes `attachMorph`, `AttachMorphOptions`, `registerMorphLayer`, `beginMorphSwipe`, and `MorphSwipe`. Part-layer integration exposes both `registerPartLayer` and `resolvePartLayer`. These declarations confirm public core access; they do not establish public React component exports.

Hold and shared-bar helpers include `animHoldKey`, `scheduleAnimHoldRelease`, `createAnimHoldCoordinator`, `eagerlyDecodeImages`, `ANIM_HOLD_RELEASE_BACKSTOP_MS`, `computeBarRiding`, and `sharedBarsMatch`. Measurement and geometry helpers include `observeBarHeight`, `readBarHeight`, `publishRideBox`, `percentRatio`, `resolveRideTarget`, `rideLength`, `RIDE_HEIGHT_VAR`, and `observeViewportScrollHeight`.

Swipe option and settlement exports include `resolveSwipeOptions`, `DEFAULT_COMMIT_FRACTION`, `DEFAULT_COMMIT_VELOCITY`, `swipeSettleSeconds`, and `MIN_SETTLE_SECONDS`, with associated input and result types. Their numeric values and algorithms are not present in this barrel.

## Runtime, platform, and DOM protocol

`startFlemoRuntime` is public. Its source comment describes shared ambient machinery started for a Router mount and released on unmount. Lower-level exports also include `ensureGpuPipelinePrewarm`, `ensureImageDecodeOffloader`, `createImageDecodeOffloader`, `shouldOffloadImage`, and `OVERSIZE_AREA_RATIO`.

`resolvePlatformProfile`, `PlatformProfile`, and `PlatformProfileInput` provide the binding's policy interface. The barrel also exposes `governedCompiledActive`, `detectBlinkEngine`, `isDesktopBlink`, `isLegacyAndroidBlink`, and `steadySixtyDesktopProfile`. Export availability does not supersede the canonical instruction to resolve named profile decisions rather than re-derive browser policy inside the binding. Platform comments in the barrel alone do not establish current routing defaults.

Protocol exports include `FLEMO_ATTR_PREFIX`, `FLEMO_ATTRIBUTES`, `attrSelector`, `attrValueSelector`, hold names and paused values, and selected screen, bar, decorator, layer, morph, Part, Router, runtime, and tooling constants. `SKIP_ANIMATION_ATTR` is exported through engine types. The attribute declaration module and this public re-export list are separate boundaries; declaration in the former does not automatically establish export from the latter.

Stacking exports are `OVERLAY_LEVEL`, `SCREEN_STACKING_ORDER`, and `UNNUMBERED_LEVEL`. `TRANSITIONAL_STATUS_VALUES` is also public. Consult [binding lifecycle and DOM protocol](../motion-engine/binding-lifecycle-and-dom-protocol.md) for ownership contracts.

Utility exports include `isServer`, `getParams`, `getMatchedPathPattern`, `matchesPathname`, `isOpaqueColor`, `buildRoutePath`, `findScrollable`, `overflowsAxis`, and `canProgrammaticallyScroll`.

## React package contract

The captured manifest names `@flemo/react` at version `2.6.2`. It declares `type: "module"`; both `main` and `module` point to `./dist/index.mjs`, and `types` points to `./dist/index.d.ts`. It contains no `exports` map. These fields do not establish additional supported subpath APIs.

React and React DOM are peers, each with range `^19.2.8`. Development dependencies separately declare `react` and `react-dom` as `^19.3.0`; those development ranges do not replace the consumer peer requirements.

Runtime dependencies are `@flemo/core: workspace:*`, `path-to-regexp: ^8.4.2`, and `zustand: ^5.0.15`. The workspace declaration does not show the dependency range produced in a published package.

The manifest declares `sideEffects: false`, a `files` allowlist containing `dist`, and public publish access. These are packaging declarations, not proof of bundle elimination or an inspected archive's exact contents.

Package scripts use Vite for build and watch, ESLint for lint, `tsc --noEmit` for typechecking, and Vitest for tests, coverage, and test watching. `clean` removes `dist` and `.turbo`. Full repository validation remains governed by [workspace commands](../../instructions/workspace-commands.md).

No build, test, packed smoke test, registry lookup, or publication was observed in this assessment.
