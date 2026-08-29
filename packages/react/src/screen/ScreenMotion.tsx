import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import { createPortal, flushSync } from "react-dom";

import {
  animHoldKey,
  ANIM_HOLD,
  ACTIVE_ATTR,
  ANIM_HOLD_ATTR,
  beginMorphSwipe,
  computeBarRiding,
  computeScreenFreeze,
  eagerlyDecodeImages,
  isOpaqueColor,
  createSwipeController,
  LAYER_HOST_ATTR,
  OVERLAY_LEVEL,
  STATUS_ATTR,
  TRANSITION_ATTR,
  createTransitionEngine,
  decoratorMap,
  enteringInitialStyle,
  observeBarHeight,
  publishRideBox,
  resolvePlatformProfile,
  resolveTransition,
  restLayerPromotionEnabled,
  sharedBarsMatch,
  type AnimHoldCoordinator,
  type MorphSwipe
} from "@flemo/core";

import {
  LayerHostContext,
  LayerOwnerContext,
  useLayerHost,
  type LayerOwner
} from "@screen/LayerContext";
import getScopeAnimHoldCoordinator from "@screen/scopeAnimHoldCoordinator";

import type { ScreenProps } from "@screen/Screen";
import ScreenDecorator from "@screen/ScreenDecorator";

import { useScreenViewport } from "@screen/ScreenViewportContext";
import useScreen from "@screen/useScreen";

import useViewportScrollHeight from "@screen/useViewportScrollHeight";

import useHydrationSafeFlag from "@utils/useHydrationSafeFlag";

import useHistoryStore from "@stores/useHistoryStore";
import useNavigateStore from "@stores/useNavigateStore";
import useScreenStore from "@stores/useScreenStore";
import useStores from "@stores/useStores";

import RouterIdContext from "../RouterIdContext";

// Every per-browser decision this component makes comes from ONE call:
// `resolvePlatformProfile()` (@flemo/core). This file asks and renders; it does
// not derive policy. The reasoning behind each field — which populations were
// measured, what each one is curing — lives with the profile, so core and the
// binding cannot disagree about it. That disagreement is not hypothetical: the
// settle gate's arming widened here while the flag enabling it stayed
// WebKit-only in core, and Android ran ungated for two release rounds.
//
// The profile is resolved PER DECISION, never hoisted: every field reads its
// flag live, so a DevTools toggle takes effect on the next navigation.

function ScreenMotion({
  children,
  statusBarHeight,
  statusBarColor,
  systemNavigationBarHeight,
  systemNavigationBarColor,
  sharedTopBar,
  sharedTopBarId,
  sharedBottomBar,
  sharedBottomBarId,
  topBar,
  bottomBar,
  hideStatusBar,
  hideSystemNavigationBar,
  backgroundColor = "white",
  contentScrollable = true,
  paintHidden = false,
  ...props
}: ScreenProps) {
  const { id, isActive, isRoot, isPrev, zIndex, transitionName, prevTransitionName } = useScreen();

  // A root <Router> renders screens fixed to the viewport; a nested <Router>
  // (a transition region inside a persistent layout) contains them, so the
  // screen container and its viewport-level chrome anchor to the region via
  // `position: absolute` instead.
  const { contained } = useScreenViewport();
  const screenPosition = contained ? "absolute" : "fixed";

  const stores = useStores();
  // The owning Router's boundary marker (see RouterIdContext) — stamped on
  // the screen and both shared bars so the engine can scope choreography
  // participants to this Router's flight.
  const routerId = useContext(RouterIdContext);

  const index = useHistoryStore((state) => state.index);
  const histories = useHistoryStore((state) => state.histories);

  // Only the top screen and the one beneath it ever take part in a
  // transition. A RESTING screen deeper in the stack pins its status
  // subscription to a constant, so the store's transitional flips never
  // re-render it — measured at depth ~20, the un-pinned subscription turned
  // every navigation's status flip into an O(depth) re-render plus an
  // attribute-write storm landing exactly on the convergence frames. Role
  // changes (a pop making this screen top again) arrive through the
  // history subscription above, which re-renders and re-evaluates the pin.
  const participatesInTransition = isActive || zIndex === index - 1;
  const status = useNavigateStore((state) =>
    participatesInTransition ? state.status : "COMPLETED"
  );
  const dragStatus = useScreenStore((state) => state.dragStatus);
  const replaceTransitionStatus = useScreenStore((state) => state.replaceTransitionStatus);
  const setDragStatus = stores.screen.getState().setDragStatus;
  const setReplaceTransitionStatus = stores.screen.getState().setReplaceTransitionStatus;

  // The partner screen this one would hand its shared bars to (the active top
  // looks one below; a prev looks at the top). Subscribe to JUST that entry so
  // bar-riding recomputes when the partner registers/unregisters its bars,
  // without re-rendering on unrelated screens' bars.
  const partnerId = isActive ? histories[index - 1]?.id : histories[index]?.id;
  const partnerBars = useScreenStore((state) =>
    partnerId ? state.sharedBars[partnerId] : undefined
  );
  const partnerBarMetadata = useScreenStore((state) =>
    partnerId ? state.sharedBarMetadata[partnerId] : undefined
  );
  // The partner's scope surface: a prev screen entering on pop parks at its
  // destination during the hold ONLY when the screen covering it (its partner,
  // the current top) has an opaque background — otherwise the park would shine
  // through and the paused hold is kept.
  const partnerSurface = useScreenStore((state) =>
    partnerId ? state.screenSurfaces[partnerId] : undefined
  );

  // Framework-neutral lifecycle engine, stable for this screen's lifetime.
  // It owns when the navigation task resolves and the COMPLETED cleanup; the
  // store callbacks below are stable for this router scope.
  const engineRef = useRef<ReturnType<typeof createTransitionEngine> | null>(null);
  if (!engineRef.current) {
    engineRef.current = createTransitionEngine({
      getTransitionTaskId: () => stores.navigate.getState().transitionTaskId,
      setDragStatus,
      setReplaceTransitionStatus
    });
  }
  const engine = engineRef.current;

  // The pop pair-release barrier for THIS Router scope, resolved once per screen
  // and shared across every screen in the scope (keyed by the scope's navigate
  // store — see getScopeAnimHoldCoordinator). Read like engineRef above: a
  // stable per-scope object looked up during the first render.
  const coordinatorRef = useRef<AnimHoldCoordinator | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = getScopeAnimHoldCoordinator(stores.navigate);
  }

  const currentTransition = resolveTransition(transitionName);
  const { initial, swipeDirection, decoratorName } = currentTransition;
  const decorator = decoratorMap.get(decoratorName!);

  const { viewportScrollHeight } = useViewportScrollHeight();

  const isKeyboardVisible = viewportScrollHeight > 0;

  // The <Layer> host. State rather than a ref because a portal can only render
  // once its target exists, and a ref would hold the element without ever
  // telling the children it arrived.
  const [layerHost, setLayerHost] = useState<HTMLDivElement | null>(null);
  // Only the OUTERMOST screen renders one; every screen nested inside it
  // inherits this. An overlay has to clear the chrome of every screen above
  // its own, and chrome an ancestor declared sits outside that ancestor's
  // scope — so a host in a nested container is already one box too deep. What
  // nesting must NOT cost is ownership, and that is the owner context below,
  // which every screen overwrites for its own children.
  const inheritedLayerHost = useLayerHost();
  const layerHostTarget = inheritedLayerHost ?? layerHost;
  // Whether this screen currently HAS an escaped overlay. The dim has to
  // follow one out (see below), and a dim rendered unconditionally would paint
  // over the shared bars on every flight whether an overlay exists or not.
  const layerSlotsRef = useRef<Set<HTMLElement>>(new Set());
  const [hasLayerSlot, setHasLayerSlot] = useState(false);
  const registerSlot = useCallback((element: HTMLElement | null) => {
    const slots = layerSlotsRef.current;
    if (element) slots.add(element);
    else slots.clear();
    setHasLayerSlot(slots.size > 0);
  }, []);

  const hasSharedTopBar = !!sharedTopBar;
  const hasSharedBottomBar = !!sharedBottomBar;
  const topBarKey = hasSharedTopBar ? `${typeof sharedTopBarId}:${String(sharedTopBarId)}` : null;
  const bottomBarKey = hasSharedBottomBar
    ? `${typeof sharedBottomBarId}:${String(sharedBottomBarId)}`
    : null;

  const [topBarMeasurement, setTopBarMeasurement] = useState({
    key: topBarKey,
    height: 0
  });
  const [bottomBarMeasurement, setBottomBarMeasurement] = useState({
    key: bottomBarKey,
    height: 0
  });
  // Ref callbacks run in the mutation phase, before layout effects. Mirror the
  // latest positive measurement outside React state so the registration layout
  // effect can publish identity + height in its very first store write.
  const topBarMeasurementRef = useRef(topBarMeasurement);
  const bottomBarMeasurementRef = useRef(bottomBarMeasurement);

  const measuredTopBarHeight = topBarMeasurement.key === topBarKey ? topBarMeasurement.height : 0;
  const measuredBottomBarHeight =
    bottomBarMeasurement.key === bottomBarKey ? bottomBarMeasurement.height : 0;
  const partnerTopBarHeight = sharedBarsMatch(
    hasSharedTopBar ? { id: sharedTopBarId } : undefined,
    partnerBarMetadata?.topBar
  )
    ? (partnerBarMetadata?.topBar?.height ?? 0)
    : 0;
  const partnerBottomBarHeight = sharedBarsMatch(
    hasSharedBottomBar ? { id: sharedBottomBarId } : undefined,
    partnerBarMetadata?.bottomBar
  )
    ? (partnerBarMetadata?.bottomBar?.height ?? 0)
    : 0;
  // A matching partner's last real measurement seeds the destination's FIRST
  // render. A local measurement wins as soon as this screen's own bar lays out.
  const sharedTopBarHeight = measuredTopBarHeight || partnerTopBarHeight;
  const sharedBottomBarHeight = measuredBottomBarHeight || partnerBottomBarHeight;

  const screenRef = useRef<HTMLDivElement | null>(null);
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const decoratorRef = useRef<HTMLDivElement | null>(null);
  const sharedTopBarSpacerRef = useRef<HTMLDivElement | null>(null);
  const sharedBottomBarSpacerRef = useRef<HTMLDivElement | null>(null);
  const sharedTopBarRef = useRef<HTMLDivElement | null>(null);
  const sharedBottomBarRef = useRef<HTMLDivElement | null>(null);

  const commitTopBarHeight = useCallback(
    (height: number) => {
      if (height <= 0 || topBarKey === null) return;
      // Ref attachment and ResizeObserver callbacks can run before React's
      // follow-up render. Write the spacer in the same commit so no browser
      // paint can observe a real bar paired with a zero-height reservation.
      if (sharedTopBarSpacerRef.current) {
        sharedTopBarSpacerRef.current.style.minHeight = `${height}px`;
      }
      topBarMeasurementRef.current = { key: topBarKey, height };
      setTopBarMeasurement((current) =>
        current.key === topBarKey && current.height === height
          ? current
          : { key: topBarKey, height }
      );
      stores.screen.getState().updateSharedBarHeight(id, "topBar", height);
    },
    [id, stores.screen, topBarKey]
  );

  const commitBottomBarHeight = useCallback(
    (height: number) => {
      if (height <= 0 || bottomBarKey === null) return;
      if (sharedBottomBarSpacerRef.current) {
        sharedBottomBarSpacerRef.current.style.minHeight = `${height}px`;
      }
      bottomBarMeasurementRef.current = { key: bottomBarKey, height };
      setBottomBarMeasurement((current) =>
        current.key === bottomBarKey && current.height === height
          ? current
          : { key: bottomBarKey, height }
      );
      stores.screen.getState().updateSharedBarHeight(id, "bottomBar", height);
    },
    [bottomBarKey, id, stores.screen]
  );

  const attachSharedTopBar = useCallback(
    (element: HTMLDivElement | null) => {
      sharedTopBarRef.current = element;
      if (element?.offsetHeight) commitTopBarHeight(element.offsetHeight);
    },
    [commitTopBarHeight]
  );

  const attachSharedBottomBar = useCallback(
    (element: HTMLDivElement | null) => {
      sharedBottomBarRef.current = element;
      if (element?.offsetHeight) commitBottomBarHeight(element.offsetHeight);
    },
    [commitBottomBarHeight]
  );

  // Framework-neutral swipe-back controller, stable for this screen's lifetime.
  // It holds the gesture state and drives the transition/decorator swipe
  // callbacks. Live render values it needs are mirrored into `swipeEnvRef`
  // each render (a "latest ref"), so the controller's stable getters always
  // read current state; element refs are read live via `.current`.
  const swipeEnvRef = useRef({
    transition: currentTransition,
    decorator,
    hasSharedTopBar: !!sharedTopBar,
    hasSharedBottomBar: !!sharedBottomBar,
    sharedTopBarId,
    sharedBottomBarId,
    viewportScrollHeight,
    isRoot,
    isActive,
    status,
    dragStatus,
    index
  });
  swipeEnvRef.current = {
    transition: currentTransition,
    decorator,
    hasSharedTopBar: !!sharedTopBar,
    hasSharedBottomBar: !!sharedBottomBar,
    sharedTopBarId,
    sharedBottomBarId,
    viewportScrollHeight,
    isRoot,
    isActive,
    status,
    dragStatus,
    index
  };

  const swipeControllerRef = useRef<ReturnType<typeof createSwipeController> | null>(null);
  // The gesture's own morph flights, alive only between a drag's start and its
  // release.
  const morphSwipeRef = useRef<MorphSwipe | null>(null);
  if (!swipeControllerRef.current) {
    swipeControllerRef.current = createSwipeController({
      getTransition: () => swipeEnvRef.current.transition,
      getDecorator: () => swipeEnvRef.current.decorator,
      getElements: () => ({
        scope: scopeRef.current,
        screenContainer: screenRef.current,
        decorator: decoratorRef.current,
        sharedTopBar: sharedTopBarRef.current,
        sharedBottomBar: sharedBottomBarRef.current
      }),
      hasSharedTopBar: () => swipeEnvRef.current.hasSharedTopBar,
      hasSharedBottomBar: () => swipeEnvRef.current.hasSharedBottomBar,
      getSharedTopBarId: () => swipeEnvRef.current.sharedTopBarId,
      getSharedBottomBarId: () => swipeEnvRef.current.sharedBottomBarId,
      getViewportScrollHeight: () => swipeEnvRef.current.viewportScrollHeight,
      isReadyForDrag: () => {
        const env = swipeEnvRef.current;
        return (
          !env.isRoot &&
          env.isActive &&
          env.status === "COMPLETED" &&
          env.dragStatus === "IDLE" &&
          !!env.transition.swipeDirection &&
          env.viewportScrollHeight < 10
        );
      },
      getPartnerBars: () => {
        const env = swipeEnvRef.current;
        const histories = stores.history.getState().histories;
        const partnerId = env.isActive ? histories[env.index - 1]?.id : histories[env.index]?.id;
        return partnerId ? stores.screen.getState().sharedBars[partnerId] : undefined;
      },
      getPartnerBarMetadata: () => {
        const env = swipeEnvRef.current;
        const histories = stores.history.getState().histories;
        const partnerId = env.isActive ? histories[env.index - 1]?.id : histories[env.index]?.id;
        return partnerId ? stores.screen.getState().sharedBarMetadata[partnerId] : undefined;
      },
      setDragStatus,
      // The ROUTER's own back, not the browser's — `window.history` under a
      // memory Router belongs to the page AROUND it, so committing there used
      // to navigate the whole document away instead of popping the stack the
      // gesture was dragging. Every scope mounts the history sync, so this one
      // call is the commit on both backends, and it lands SYNCHRONOUSLY: the
      // code below depends on the landing flight already existing.
      back: () => stores.driver.back(),
      // THE SHARED ELEMENT FOLLOWS THE FINGER.
      //
      // A morph cannot be driven from a transition's swipe hooks the way a
      // screen or a <Part> is — the element belongs to a flight the runtime
      // stages, not to the author. So the gesture is handed to the morph
      // runtime here, once, and every transition that declares a
      // `swipeDirection` gets an interactive morph without authoring one.
      //
      // A drag that pairs nothing costs nothing: the handle reports itself
      // inactive and every call after that is a no-op.
      onDragStart: () => {
        morphSwipeRef.current = beginMorphSwipe(stores.navigate, "POPPING");
      },
      onDragProgress: (progress) => {
        morphSwipeRef.current?.scrub(progress);
      },
      onDragSettle: (committed, seconds) => {
        morphSwipeRef.current?.settle(committed, seconds);
        morphSwipeRef.current = null;
      }
    });
  }
  const swipeController = swipeControllerRef.current;

  const handlePointerDown = (event: ReactPointerEvent) =>
    swipeController.pointerDown(event.nativeEvent);
  const handlePointerMove = (event: ReactPointerEvent) =>
    swipeController.pointerMove(event.nativeEvent);
  const handlePointerUp = (event: ReactPointerEvent) =>
    swipeController.pointerUp(event.nativeEvent);
  const handlePointerCancel = (event: ReactPointerEvent) =>
    swipeController.pointerCancel(event.nativeEvent);
  // Capture released without the gesture ending: the element went out from
  // under it. WebKit does not follow that with a pointerup or a pointercancel,
  // so this is the only notice the controller gets.
  const handleLostPointerCapture = (event: ReactPointerEvent) =>
    swipeController.lostPointerCapture(event.nativeEvent);
  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    // PUSHING / REPLACING used to apply pointer-events:none to the entire
    // moving screen. That blocked activation, but also permanently targeted a
    // transition-adjacent scroll at the covered screen. Keep the destination
    // hit-testable for native scrolling and preserve only the activation gate.
    if (status === "PUSHING" || status === "REPLACING") {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  // Warm the image-decode cache every time this screen becomes live. Activity
  // unmounts a frozen screen's effects and remounts them on unfreeze, so a
  // mount effect fires exactly at every unfreeze — including a SWIPE reveal,
  // which no hold can cover (the finger drives the motion). Near-free when the
  // decoded data is still cached; on first mount images are not complete yet
  // and are skipped.
  useEffect(() => {
    eagerlyDecodeImages(scopeRef.current);
  }, []);

  useEffect(() => {
    const scope = scopeRef.current;

    if (!scope) return;

    const handleTouchMove = (event: TouchEvent) => {
      if (swipeController.shouldPreventTouch()) {
        event.preventDefault();
      }
    };

    scope.addEventListener("touchmove", handleTouchMove, {
      passive: false
    });

    return () => {
      scope.removeEventListener("touchmove", handleTouchMove);
      // The screen is going away under whatever gesture is in flight — an
      // unmount, or a freeze, which tears these effects down while the
      // controller (a ref) survives to be re-attached later still armed. An
      // armed controller preventDefaults every touchmove, so leaving one behind
      // hands the revived screen a dead scroll that only the vanished pointer
      // could have cleared.
      swipeController.abandon();
    };
  }, [swipeController]);

  // Ref attachment has already measured any laid-out bar. Register that local
  // height together with its identity so the first store notification is never
  // an intermediate height-less entry. Activity hidden mode disconnects this
  // effect (and its cleanup removes the registry entry); on unfreeze the refs /
  // state survive and this same registration restores the complete metadata.
  // The following observer effect is then only an idempotent initial check plus
  // the long-lived dynamic resize channel.
  useLayoutEffect(() => {
    const { registerSharedBars, unregisterSharedBars } = stores.screen.getState();
    const topMeasurement = topBarMeasurementRef.current;
    const bottomMeasurement = bottomBarMeasurementRef.current;
    registerSharedBars(
      id,
      {
        topBar: hasSharedTopBar,
        bottomBar: hasSharedBottomBar
      },
      {
        topBar: hasSharedTopBar
          ? {
              id: sharedTopBarId,
              height: topMeasurement.key === topBarKey ? topMeasurement.height : undefined
            }
          : undefined,
        bottomBar: hasSharedBottomBar
          ? {
              id: sharedBottomBarId,
              height: bottomMeasurement.key === bottomBarKey ? bottomMeasurement.height : undefined
            }
          : undefined
      }
    );
    return () => unregisterSharedBars(id);
  }, [
    bottomBarKey,
    hasSharedBottomBar,
    hasSharedTopBar,
    id,
    sharedBottomBarId,
    sharedTopBarId,
    stores.screen,
    topBarKey
  ]);

  // Bar-height tracking (incl. the ignore-0-while-frozen WebKit gotcha) lives
  // in @flemo/core's observeBarHeight. The commit callbacks also update the
  // spacer directly so the reservation and real bar cannot paint out of sync.
  //
  // Keyed on WHETHER there is a bar, never on the bar node. What gets observed
  // is flemo's own `[data-flemo-bar]` wrapper below, and the consumer's node
  // only ever renders INSIDE it — so that wrapper's identity changes exactly
  // when `hasSharedTopBar` flips, and nothing else can change it. The node,
  // meanwhile, is a fresh element on every consumer render (that is what
  // `sharedTopBar={<TabBar />}` is), and keying on it re-ran this effect once
  // per consumer render: disconnect the observer, read `offsetHeight` (a
  // forced layout, in a layout effect, so pre-paint), observe again, and take
  // the new observer's initial callback. A screen that re-renders during a
  // flight — a data refetch storm on arrival is measured at dozens of commits
  // — paid all of that on the frames the motion is watched.
  useLayoutEffect(() => {
    const element = sharedTopBarRef.current;
    if (!element) return undefined;
    return observeBarHeight(element, commitTopBarHeight);
  }, [commitTopBarHeight, hasSharedTopBar]);

  useLayoutEffect(() => {
    const element = sharedBottomBarRef.current;
    if (!element) return undefined;
    return observeBarHeight(element, commitBottomBarHeight);
  }, [commitBottomBarHeight, hasSharedBottomBar]);

  // The other direction of the same measurement: the bars need to know how tall
  // the SCREEN is, because a ride-along runs the screen's keyframes on the bar's
  // own box and a percentage offset resolves against whichever box it lands on
  // (rideOffset.ts). Published on screenRef, which the bars inherit from, and
  // only while there IS a bar — presence-keyed for the same reason the height
  // observers above are, so a screen with no shared chrome carries no observer.
  useLayoutEffect(() => {
    const element = screenRef.current;
    if (!element) return undefined;
    if (!hasSharedTopBar && !hasSharedBottomBar) return undefined;
    return publishRideBox(element);
  }, [hasSharedBottomBar, hasSharedTopBar]);

  // Register this screen's scope surface (is its background opaque?) so the
  // screen beneath can decide between the destination park and the paused
  // hold. Measured from the COMPUTED style so CSS variables and theme values
  // resolve; re-measured pre-paint on every status flip (`status` dep) so a
  // theme switch between navigations can't leave a stale answer — this runs on
  // live screens only, and the covering screen during any transition is live.
  useLayoutEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return undefined;
    const { registerScreenSurface, unregisterScreenSurface } = stores.screen.getState();
    registerScreenSurface(id, {
      opaqueBackground: isOpaqueColor(getComputedStyle(scope).backgroundColor)
    });
    return () => unregisterScreenSurface(id);
  }, [id, backgroundColor, status, stores.screen]);

  // Shared bars render outside the animated scope (siblings inside screenRef),
  // so any transition the scope runs has no inherent effect on the bar. When
  // the partner screen owns the same bar, this is exactly what we want: the
  // bar appears to hand over seamlessly while screens animate underneath.
  // When the partner does NOT own the bar, the bar must ride along.
  //
  // Two paths handle ride-along:
  //
  // 1. CSS-driven transitions (push / pop / replace). The compiled rule emits
  //    a sibling selector that targets `[data-flemo-bar][...riding="true"]`
  //    with the same `@keyframes` the screen uses. `data-flemo-bar-riding` is
  //    computed here in RENDER and set on the bar below, in the SAME commit as
  //    the bar's `data-flemo-bar-status`. The compiled rule keys on both, so
  //    rendering them together guarantees one paint — a bar can't carry the
  //    POPPING status without its riding flag for a frame (which an imperative
  //    effect write could, landing late on a genuine browser-back where React
  //    reconnects the unfrozen subtree's effects as follow-up work).
  // 2. Swipe drag. Handled synchronously inside the core swipe controller,
  //    which mirrors every `animate(currentScreen, ...)` call to the riding
  //    bars in the SAME JS tick. No rAF loop, no `getComputedStyle` reads.
  //    The bars and the screen commit in the same paint pass.
  const isTopOrTopPrev = participatesInTransition;

  const { app: rideTopBar, nav: rideBottomBar } = computeBarRiding({
    status,
    isTopOrTopPrev,
    hasTopBar: hasSharedTopBar,
    hasNavBar: hasSharedBottomBar,
    topBarId: sharedTopBarId,
    bottomBarId: sharedBottomBarId,
    partnerBars,
    partnerMetadata: partnerBarMetadata
  });

  // Anchor the transition START to the first PAINTED frame. iOS WebKit anchors
  // a CSS animation's timeline when the style change commits; when the entering
  // screen's first frame is expensive (layout + raster of a heavy subtree on a
  // mobile GPU, ~50ms on an iPhone), the timeline keeps running while nothing
  // new is presented, so the opening of the transition is simply never
  // displayed — measured on device as `animation.currentTime` already 25-50ms
  // ahead on the second frame and `animationend` firing ~50ms early relative
  // to first paint. A 200ms transition visibly loses its first quarter and
  // reads as abbreviated. Hold every freshly started transition animation
  // paused for the screen's first two frames (the compiled hold rule pins
  // `animation-play-state`; `fill: both` keeps the keyframe's `from` value
  // applied while paused, so the heavy raster happens AT the initial state),
  // then release: the full duration now plays against already-rasterized
  // layers. The decision (`animHoldKey`) and release scheduling (the
  // double-rAF + decode readiness gate, and the pop pair barrier that releases
  // both screens together — see createAnimHoldCoordinator) live in @flemo/core
  // so other bindings anchor identically; this binding's own part is flipping
  // the flag ON in the SAME render that changes the status attribute — computed
  // in render, not an effect — so an Activity-unfrozen screen (whose effects
  // reconnect as follow-up work) still holds from its very first frame.
  const holdKey = animHoldKey({ status, isTopOrTopPrev, transitionName });

  // This screen's freeze state, recomputed from the SAME framework-neutral
  // predicate Screen.tsx feeds <ScreenFreeze> (computeScreenFreeze). Tracked
  // here only so the anim-hold can tell whether the screen is WAKING from a
  // freeze for this transition.
  const isFrozen = computeScreenFreeze({
    isActive,
    isPrev,
    zIndex,
    index,
    status,
    dragStatus,
    replaceTransitionStatus
  });

  // Whether this screen was frozen (Activity-hidden) in the PREVIOUS commit.
  // Tracked in RENDER, never an effect: <Activity> disconnects a hidden
  // screen's effects, so an effect never observes the frozen commit — but the
  // render function still runs (at offscreen priority) while hidden, so this
  // ref always reflects the last committed freeze.
  const wasFrozenRef = useRef(isFrozen);
  // decodeWait for the transition currently held, captured when the hold
  // (re)arms. True only when this screen was frozen just before the transition
  // and is now revealed (pop destination, traversal reveal): only a screen
  // waking from a freeze has discarded bitmaps to re-decode. A visible exit
  // side, the exiting top, and a fresh mount capture false, so they skip the
  // decode wait — which is what makes pair-gating push/replace free. The
  // initializer covers the mount-into-transition case (a screen mounted already
  // holding, so the hold key never "changes"): use this commit's freeze, since
  // there is no prior commit to compare against.
  const decodeWaitRef = useRef(holdKey !== null && isFrozen);

  // The imperative release, remembered for RENDER. The DOM flip below writes
  // `data-flemo-anim-hold="false"` inside the readiness rAF; from that moment
  // this screen IS released, whatever React state still says. Reading it here
  // means an interleaved commit renders the released value instead of writing
  // the paused hold attribute back over a running animation — the defect
  // `flushSync` was closing by timing, closed by construction instead, which is
  // what lets the reconcile leave the release frame (profile.deferReleaseCommit).
  const releasedKeyRef = useRef<string | null>(null);

  // The hold key whose park-over was granted, remembered past the release so the
  // parked head keeps matching for as long as it runs (see `parkHead` below).
  const parkHeadKeyRef = useRef<string | null>(null);

  const [animRelease, setAnimRelease] = useState<{ key: string | null; released: boolean }>({
    key: holdKey,
    released: holdKey === null
  });
  if (animRelease.key !== holdKey) {
    // Render-phase adjustment: React re-runs this component with the new state
    // before committing, so the hold and status attributes always land in the
    // same paint.
    setAnimRelease({ key: holdKey, released: holdKey === null });
    // A new hold starts held: the previous flight's imperative release must not
    // leak into it.
    releasedKeyRef.current = null;
    // Nor its park. Hold keys are `${status}:${transition}`, so two pushes in a
    // row share one — without this, the second would inherit the first's mark
    // and park a head whose cover was never measured.
    parkHeadKeyRef.current = null;
    // Capture the wake-from-freeze signal for this hold BEFORE the tracker
    // below advances to the current commit's freeze value.
    decodeWaitRef.current = holdKey !== null && wasFrozenRef.current;
  }
  wasFrozenRef.current = isFrozen;
  const animHold =
    holdKey !== null &&
    animRelease.key === holdKey &&
    !animRelease.released &&
    releasedKeyRef.current !== holdKey;

  // NOTE (shell-first, removed): a release-gated children mount (screen shell in
  // the first commit, consumer `children` one commit after the hold release) was
  // shipped and REVERTED here. It protected the rare atomic-heavy entrant, but
  // deferring unconditionally made every LIGHT screen enter as a blank shell
  // with its content popping in after the transition started — on real apps
  // (dark background + instant content) that reads as flicker/double-render.
  // Children mount synchronously with the screen again; the anim-hold anchors
  // the motion to their painted first frame, and a long mount block delays the
  // start instead of losing the window (the transition gate re-arms until the
  // hold releases — see TaskManger.armBackstop / setMotionAnchoredTaskId).

  // Four-state hold attribute. "park" pre-positions a COVERED entering screen
  // (pop) at its destination so its tiles rasterize during the hold;
  // "park-under" is the push-side mirror — the ACTIVE ENTERING screen (push/
  // replace only: on pop the active screen is the LEAVING top, and sinking it
  // would expose the returning screen — a back-navigation flash) parks at its
  // destination but z-ordered BENEATH the previous screen, which covers it
  // for the hold window (gated on that screen's verifiably opaque surface).
  // Everything else holds paused ("true"); variants without a matching park
  // rule fall back to paused under either park value, so this can never
  // flash.
  const holdAttr = !animHold
    ? ANIM_HOLD.RELEASED
    : !isActive && partnerSurface?.opaqueBackground
      ? ANIM_HOLD.PARK
      : isActive &&
          (status === "PUSHING" || status === "REPLACING") &&
          partnerSurface?.opaqueBackground
        ? resolvePlatformProfile().parkOver
          ? // Touch WebKit parks the entering screen ON TOP at 0.02 opacity by
            // default (2026-08-20/21 device round): park-under leaves the layer
            // occluded, and the tiles the slide is about to reveal are then
            // first rastered at the release — the ~100ms the head exists to
            // cover. Painting them during the hold measurably steadied the
            // motion (drops in the moving phase 2/19 → 1/19 on a real iPhone).
            ANIM_HOLD.PARK_OVER
          : ANIM_HOLD.PARK_UNDER
        : ANIM_HOLD.HELD;

  // Whether the head that follows this hold should carry the park pose instead
  // of the off-screen from-pose (see PARK_HEAD_ATTR). Sticky across the release
  // on purpose: the attribute has to still be there for the 200ms the head runs,
  // and by then `holdAttr` has long since read RELEASED. Keyed on the flight's
  // own hold key so the next navigation starts from nothing — a stale mark would
  // park a screen whose cover was never measured opaque.
  //
  // Only park-over earns it. park-under leaves the layer occluded, which is what
  // stopped WebKit rastering it in the first place, so carrying THAT pose
  // through the head would buy nothing and cost a stacking decision.
  if (
    parkHeadKeyRef.current !== holdKey &&
    holdAttr === ANIM_HOLD.PARK_OVER &&
    resolvePlatformProfile().parkHead
  ) {
    parkHeadKeyRef.current = holdKey;
  }
  const parkHead = holdKey !== null && parkHeadKeyRef.current === holdKey;

  // What a <Layer> slot needs to keep being this screen while sitting outside
  // it. Every value here is one the slot cannot get by being where it is: it
  // is a sibling of no scope it belongs to, in a container that may not even
  // be this screen's, so its stack position, its paint state and the flight it
  // is part of all have to be handed over. See LayerContext.
  const layerOwner: LayerOwner = {
    zIndex,
    paintHidden,
    transitionName,
    status,
    isActive,
    animHold: holdAttr,
    rendersHost: !inheritedLayerHost,
    screenId: id,
    registerSlot
  };

  // The scope's REST promotion (`flemo:preraster=on`). Browser-only state that
  // reaches the DOM as an INLINE STYLE, so it is read through the hydration
  // gate: evaluated directly, a server-rendered screen emits no `will-change`
  // while the hydration render asks for one, and React reports a style mismatch
  // on [data-flemo-screen]. The gate renders `false` for the server and the
  // hydration render only, then re-renders with the real value one commit
  // later — at rest, where nothing is animating.
  //
  // The FLIGHT-time promotion is not here: the engine stamps every participant
  // for the length of the flight (layerSettleHold), on every tier. The binding
  // used to promote the scope through the hold as well, and that duplicate is
  // what made the stamp restore a promotion forever — see the profile's
  // `restLayerPromotion` note in core.
  const restLayerPromotion = useHydrationSafeFlag(restLayerPromotionEnabled);

  // Drive the navigation-task lifecycle through the framework-neutral engine.
  // It resolves the active screen's task on its animationend (or a microtask
  // for no-animation variants) and runs the COMPLETED cleanup on the scope,
  // decorator, and shared bars. `useLayoutEffect` so the listener attaches and
  // the cleanup runs pre-paint, before the first animation frame.
  useLayoutEffect(
    () =>
      engine.driveScreenLifecycle({
        getElements: () => ({
          scope: scopeRef.current,
          decorator: decoratorRef.current,
          bars: [sharedTopBarRef.current, sharedBottomBarRef.current],
          // Not the overlays themselves: a nested screen's <Layer> lives in an
          // ancestor's host, so which elements ride is a rule over the DOM
          // rather than a ref the binding holds (see core layerRiders.ts).
          screenContainer: screenRef.current
        }),
        transitionName,
        prevTransitionName,
        status,
        isActive,
        // The flight's motion starts exactly at hold release; the compiled
        // hold/park rules own every frame before it. Included in the deps so
        // the release re-runs this effect.
        animHoldReleased: !animHold
      }),
    [engine, status, isActive, prevTransitionName, transitionName, animHold]
  );

  useEffect(() => {
    if (!animHold || holdKey === null) return undefined;
    const key = holdKey;
    // Join this screen's release to the scope's coordinator instead of releasing
    // it in isolation. For a POP the coordinator holds this screen paused until
    // its partner is also ready, so the pair starts on one clock (see
    // createAnimHoldCoordinator); for push/replace it delegates straight to
    // scheduleAnimHoldRelease, so their timing is unchanged. The release
    // callback and the decode-wait scope are exactly as before.
    //
    // The group key appends the transition task id so consecutive pops reusing
    // the same hold key can never blend into one group. Safe to read
    // imperatively: the controller sets the status and the task id in the same
    // synchronous block (see createNavigationController), so when this effect
    // observes the transition both participants read the same id.
    const transitionTaskId = stores.navigate.getState().transitionTaskId;
    const groupKey = transitionTaskId === null ? key : `${key}#${transitionTaskId}`;
    return coordinatorRef.current!.join(
      groupKey,
      () => {
        // Non-Blink: flip the hold on the DOM SYNCHRONOUSLY, inside the
        // readiness rAF. Routing the release through setState alone hands
        // the attribute write to a later React task, and any task that
        // slots in between — a suspense reveal's multi-hundred-ms render —
        // stretches the gap between the compiled clock's anchor (WebKit
        // stamps a new animation with the frame-TOP timestamp of the
        // rendering update that creates it) and its first presentation.
        // That gap IS the swallowed opening: device-video'd as the exiting
        // parallax skipping its 0→30% glide and the entering sheet's first
        // presented frame already deep into the curve. A rAF callback and
        // its own frame's rendering update are ATOMIC — no task can run
        // between them — so flipping here makes clock-start and first
        // paint simultaneous BY CONSTRUCTION: no waits, no heuristics, no
        // after-the-fact correction. The setState below reconciles React
        // to the same value one commit later; the pair coordinator fires
        // both screens' callbacks in one tick, so the pair still departs
        // on one clock.
        //
        // WHO GETS IT is the profile's call (`atomicReleaseFlip`), not this
        // file's. The one input core cannot see is whether THIS transition
        // authored `driver: "native"`, so that is the one thing passed in.
        //
        // Read via the latest-ref (not the render closure) so no stale value
        // and no extra effect dependency: currentTransition is a fresh object
        // each render, which as a dep would re-run this effect every render.
        const authoredNativeDriver =
          (swipeEnvRef.current.transition as { driver?: string }).driver === "native";
        const directFlip = resolvePlatformProfile({ authoredNativeDriver }).atomicReleaseFlip;
        if (directFlip) {
          for (const el of [
            scopeRef.current,
            sharedTopBarRef.current,
            sharedBottomBarRef.current,
            decoratorRef.current
          ]) {
            if (el?.isConnected && el.getAttribute(ANIM_HOLD_ATTR) !== null) {
              el.setAttribute(ANIM_HOLD_ATTR, ANIM_HOLD.RELEASED);
            }
          }
          // park-under sank the whole screen container beneath its cover;
          // the released flight must surface in the same frame its clock
          // starts, not a React commit later. Restore the screen's own stack
          // position rather than clearing the property: the containers are
          // isolated, so `auto` would drop this screen behind every sibling
          // that still carries a number.
          if (screenRef.current) screenRef.current.style.zIndex = String(zIndex + 1);
          // From here on this screen renders as released, whoever renders it.
          releasedKeyRef.current = key;
        }
        {
          // The state must reconcile IN THIS TASK, not "one commit later":
          // any unrelated commit landing in the flip→reconcile window renders
          // this screen with the STALE held state and writes the paused hold
          // attribute back over the RUNNING animation — trace-proved
          // (2026-08-18): presents kept flowing at 60fps while the pop stood
          // frozen ~250ms mid-flight (cc drawing the same paused pose) until
          // the reconciling commit re-released it; intermittent because it
          // needs an interleaved commit, and pop-biased because the returning
          // screen's arrival re-renders supply one. flushSync closes the
          // window by construction — DOM flip and state commit in one task.
          // Universal now (not just the flip paths): the stale-held-state
          // window is a defect for every driver.
          const reconcile = () =>
            setAnimRelease((current) =>
              current.key === key && !current.released ? { key, released: true } : current
            );
          // `flemo:relcommit=defer`, and only where the DOM flip already
          // released the hold: hand the reconcile to the NEXT frame so it stops
          // competing with the flight's first present (device-measured: the
          // release-frame drop is PUSH-only, 11/18 vs 0/17 on POP). Without the
          // flip there is nothing else releasing the attribute, so the state
          // commit IS the release and must stay in this task.
          if (
            directFlip &&
            resolvePlatformProfile().deferReleaseCommit &&
            typeof requestAnimationFrame === "function"
          ) {
            requestAnimationFrame(() => reconcile());
          } else {
            flushSync(reconcile);
          }
        }
      },
      {
        // Decode-wait: a frozen screen's discarded image bitmaps re-decode
        // during the hold instead of dropping the first animated frames. Scoped
        // to screens actually waking from a freeze (decodeWaitRef) so a visible
        // or freshly-mounted screen never pays the wait, which is what keeps a
        // paired push/replace release free.
        scope: scopeRef.current,
        decodeWait: decodeWaitRef.current,
        // RENDER-settle gate (flemo:settle-gate=on): hold the motion until the
        // ENTERING screen's mount render quiesces, so the opening plays in a
        // quiet window instead of losing frames to the screen's own commit
        // storm (device-measured detail-push jank — driver-independent). Unlike
        // the #226 gate this does NOT wait on data (renderSettleOnly): a light
        // screen sees no qualifying commit and releases at firstWaitMs (no felt
        // delay); a heavy one waits out its render (adaptive) then starts clean.
        // PUSH and POP: a fresh push mounts a heavy screen; a pop returns to a
        // screen that re-renders on arrival (device-measured: 46-commit pops
        // with flip 288ms — a data refetch storm). Render-settle stays adaptive
        // either way (a truly warm return pays nothing). REPLACE (tab fade)
        // stays ungated — a whole-screen fade reads a wait as a dead tap.
        contentSettle:
          // ALL engines. The gate holds the release until the entering mount
          // render quiesces. It was thought WebKit-only (Blink rides the
          // compiled compositor through main-thread stalls), but device A/B on
          // a demoted Note 9 falsified that: its heavy detail mount runs a
          // ~290ms main-thread task that stalls even the compositor's initial
          // commit/layerization, so gating the release to AFTER that task
          // measurably helped (gate on = slight hitch, gate off = worse).
          // That finding took until 2026-08-19 to reach the DEFAULT — the
          // arming widened here while readSettleGateFlag stayed WebKit-only,
          // so Android ran ungated for two rounds. If you widen an arming
          // condition, widen the flag that enables it in the same change.
          // The gate arms on the screen whose render storm threatens the
          // flight: the ACTIVE side on push (fresh mount) — and on pop BOTH
          // sides, because the pop's storm belongs to the INACTIVE returning
          // screen (its Activity unfreeze re-renders the whole stack entry:
          // device-measured 46-commit pops). Glass-proved 2026-08-18: with
          // the atomic flip closing the release gap, an ungated returning
          // screen lands its unfreeze storm MID-flight — 133-233ms frozen
          // blocks in the pop motion — where the state-routed release had
          // been hiding it as a (felt-as-dead-tap) delayed start. The pair
          // coordinator already barriers the pop pair, so gating the
          // returning side moves the WHOLE pair's departure past the storm.
          resolvePlatformProfile().renderSettleGate &&
          (isActive ? status === "PUSHING" || status === "POPPING" : status === "POPPING")
            ? {
                // firstWaitMs: no qualifying mount commit within this → warm/
                // light screen, release with no felt delay. capMs: the hard
                // backstop (one flight span) so even a pathological render can
                // never strand the motion. Render-settle waits the full quiet
                // window (see quietSpan) so a straggler commit can't hit the
                // release frame.
                firstWaitMs: 120,
                capMs: 700,
                graceMs: 60,
                // The RETURNING side of a pop must wait out the PREVIOUS
                // push's landing storm (the batched arrival reveal + query
                // writes land two frames past that flight's rest — exactly
                // when a natural browse rhythm pops back). Those reveal
                // commits are node-light, so the mount-sized threshold
                // ignored them and launched the pop INTO the storm —
                // live-correlated (2026-08-18) with the cold-path-only,
                // rhythm-dependent "끊김" (warm revisits, which have no
                // landing storm, were judged smooth). Any commit re-arms
                // the quiet window there; the ACTIVE side keeps the
                // mount-sized threshold.
                minNodes: isActive ? 30 : 1,
                renderSettleOnly: true
              }
            : undefined
      }
    );
  }, [animHold, holdKey, holdAttr, isActive, status, stores.navigate, zIndex]);

  const initialStyle =
    holdAttr === ANIM_HOLD.PARK_UNDER || holdAttr === ANIM_HOLD.PARK_OVER
      ? // The compiled park rule holds this screen at its DESTINATION beneath
        // the previous screen; the inline entering style (the hidden `from`)
        // would override that stylesheet rule and defeat the park. On release
        // the attribute drops, this inline style returns in the same commit,
        // and the animation replays from its own `from` keyframe over the
        // already-rasterized layer.
        {}
      : enteringInitialStyle({ initial, isActive, status });

  return (
    <div
      ref={screenRef}
      onClickCapture={handleClickCapture}
      style={{
        position: screenPosition,
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        // COVERED means not painted, from the commit it is covered — the
        // release that also stops the paint can be seconds later (see
        // ScreenFreeze), and until then this screen is a window onto
        // everything under it for anything above that is not opaque. Paint is
        // the cheap half: no boxes are removed and nothing is unmounted, so
        // waking is a repaint rather than a re-layout.
        visibility: paintHidden ? "hidden" : undefined,
        // Sibling screens carry their own stack position rather than leaning
        // on DOM order, because `isolation` below hands the ordering of
        // anything that escapes a screen to THIS number. Without it a
        // consumer's `z-index: 1` beat every sibling container at `auto` and
        // painted over the screen that covered it. Offset by one so the
        // bottom screen still sits above an unpositioned ancestor background.
        //
        // During park-under the ENTERING screen must sink BENEATH the previous
        // screen while its destination tiles pre-rasterize, and that stacking
        // decision lives HERE on the outer container: a z-index on the inner
        // scope only reorders within this box and leaks the park (a
        // full-screen flash of the next screen). One below the previous
        // screen's own number does it, and never goes negative — park-under
        // only arms on a push, so there is always a screen beneath.
        zIndex: holdAttr === ANIM_HOLD.PARK_UNDER ? zIndex - 1 : zIndex + 1,
        // A stacking context WITHOUT a containing block, which is the whole
        // point: layout/paint containment and transforms would give both, and
        // the containing block is what trapped consumer bottom sheets inside a
        // nested Slot (#341). `isolation` confines what a screen stacks —
        // flemo's own dim and bars, and the consumer's own z-index — while a
        // `position: fixed` overlay still resolves against the viewport. It
        // reaches over the surrounding shared bars because this container
        // outranks them, not because it escaped the screen.
        isolation: "isolate",
        // Style containment scopes counters and quotes. It is not what keeps
        // the screen's stacking to itself; `isolation` above is.
        contain: "style",
        flexDirection: "column",
        boxSizing: "border-box",
        overscrollBehavior: "contain"
      }}
    >
      <div
        ref={scopeRef}
        {...props}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
        data-flemo-screen={id}
        data-flemo-router={routerId ?? undefined}
        data-flemo-transition={transitionName}
        data-flemo-status={status}
        data-flemo-active={isActive ? "true" : "false"}
        data-flemo-anim-hold={holdAttr}
        data-flemo-park-head={parkHead ? "true" : undefined}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          backgroundColor,
          overflowY: contentScrollable ? undefined : "auto",
          touchAction: swipeDirection === "x" ? "pan-y" : swipeDirection === "y" ? "pan-x" : "auto",
          // preraster: promote the CONTENT layer from the hold onward so the
          // tiles the outer near-zero-opacity forces WebKit to paint during
          // park-under rasterize into a composited backing store that SURVIVES
          // the release jump to the off-screen from-pose (an unpromoted layer
          // is discarded there and re-rasters on the slide — the reveal block).
          // Continuous with holdScopeLayer's own flight-time will-change, so
          // the one promoted layer spans hold → slide.
          // DEFAULT-ON for steady-60 desktop sessions (2026-08-18): Blink
          // culls the raster of the occluded park-under layer, so the push's
          // tiles rasterized MID-SLIDE — the live-judged "뚝뚝" chop (pop was
          // smooth: its returning layer is already rastered). The promotion
          // forces the backing store to fill DURING the hold instead, where
          // the settle gate's fast-frame requirement absorbs the cost. Only
          // the will-change half engages by default — the park-over hold
          // strategy stays behind the explicit flemo:preraster flag.
          // …and on steady-60 desktops the promotion also PERSISTS on the top
          // screen AT REST (2026-08-18, glass-measured): a resting top screen
          // is a plain document paint, so the next push must promote and
          // raster the WHOLE list layer at flight start — captured as the
          // push-opening crawl-freeze-leap (100-400ms, longer the more
          // infinite-scroll pages are loaded) while pops launch at full
          // velocity on their first frame BECAUSE the covered screen's parked
          // transform kept it composited the whole time. Keeping the top
          // screen promoted at rest pre-pays that raster where nobody is
          // watching. Root routers only (`!contained`): will-change makes
          // this element the containing block for `position: fixed`
          // descendants, which is visually identity-preserving when the
          // screen box IS the viewport but would break consumer overlays in
          // a nested region.
          // NOT IMPLEMENTED, kept as a lead: extending the promotion to the
          // COVERED direct-prev screen. The measurement that motivated it
          // (2026-08-18, marker-synced glass): with the top screen fully
          // occluding it at rest, cc EVICTS its tiles under a long-lived
          // session's GPU memory pressure, and the pop that re-reveals it
          // froze the whole output 216-316ms (13-19 frames, every pop, start
          // of motion) waiting on its re-raster, while rAF ticked clean —
          // activation-blocked, not main-thread-blocked, so no in-page
          // instrument sees it (the recorder's stall detector cannot: a
          // compiled animation's clock keeps advancing on the wall clock
          // while the output is frozen).
          //
          // Deliberately not shipped. Nobody is reporting that freeze today,
          // several treatments landed since the measurement (layerSettleHold,
          // the cadence video, the deferred freeze) that may have absorbed
          // it, and adding it behind a flag would be machinery with no
          // consumer — the class of debt PR #272 deleted. If a desktop pop
          // ever freezes at its opening again: add `|| zIndex === index - 1`
          // to the rest term, DESKTOP PROFILE ONLY (a second resident
          // full-screen backing store is the opposite of what a
          // memory-pressured phone needs), and judge it by eye with DevTools
          // closed or with a CDP presentation trace.
          // REST promotion, CORRECT PREDICATE this time (2026-08-18): the
          // earlier attempt keyed on `isActive`, which is false at rest, so
          // it never applied and its null A/B result was meaningless. The
          // top screen at rest is the entry whose zIndex equals the current
          // history index — keeping ITS layer promoted means the next
          // push's leaving side starts the flight with a live backing store
          // instead of paying promotion + full-layer raster on the opening
          // frames (the biggest structural GPU cost a flight still carries).
          // Root routers only (`!contained`), same containing-block
          // reasoning as before.
          //
          // OPT-IN since 2026-08-21 (`restLayerPromotion`, armed by
          // `flemo:preraster=on`): a promotion is also a STACKING CONTEXT, and
          // at rest the scope holds the entire consumer screen. Left on, a
          // consumer's own `position: fixed; z-index: 50` overlay could never
          // paint above the shared bars below (siblings at `z-index: 1`) — a
          // bottom sheet came up UNDER the tab bar on iOS Safari, with no
          // z-index on their side able to answer it. The hold-window half
          // stays default-on by tier: there the scope is transformed anyway,
          // so the confinement is already priced in and ends with the flight.
          // `layerPromotion` / `restLayerPromotion` are the session predicates
          // (deferred past hydration — see their declarations); the terms
          // beside them are the per-screen ones.
          ...(restLayerPromotion && zIndex === index && !contained
            ? { willChange: "transform" }
            : {}),
          ...initialStyle,
          ...props.style
        }}
      >
        {!hideStatusBar && statusBarHeight && (
          <div style={{ minHeight: statusBarHeight }}>
            <div
              style={{
                position: screenPosition,
                top: 0,
                width: "100%",
                minHeight: statusBarHeight,
                backgroundColor: statusBarColor
              }}
            />
          </div>
        )}
        {sharedTopBar && (
          <div
            ref={sharedTopBarSpacerRef}
            data-flemo-bar-spacer="app"
            style={{
              width: "100%",
              minHeight: sharedTopBarHeight
            }}
          />
        )}
        {topBar}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            // No compositing-layer promotion here by default. The translateZ(0)
            // content isolation (#117 → #127) targeted a WebKit stall whose real
            // root cause turned out to be the animation-start anchoring, fixed
            // by data-flemo-anim-hold: with the anchor in place, isolated and
            // non-isolated runs measure identical across desktop WebKit, the
            // iOS simulator, and Chrome frame telemetry. Dropping the transform
            // also stops this box from being a containing block, so a consumer
            // `position: fixed` overlay works inside the content without any
            // escape hatch (the former <Layer>).
            overflowY: contentScrollable ? "auto" : undefined
          }}
        >
          <LayerHostContext.Provider value={layerHostTarget}>
            <LayerOwnerContext.Provider value={layerOwner}>{children}</LayerOwnerContext.Provider>
          </LayerHostContext.Provider>
        </div>
        {bottomBar}
        {sharedBottomBar && (
          <div
            ref={sharedBottomBarSpacerRef}
            data-flemo-bar-spacer="nav"
            style={{
              display: isKeyboardVisible ? "none" : undefined,
              width: "100%",
              minHeight: sharedBottomBarHeight
            }}
          />
        )}
        {!hideSystemNavigationBar && systemNavigationBarHeight && (
          <div
            style={{
              display: isKeyboardVisible ? "none" : undefined,
              minHeight: systemNavigationBarHeight
            }}
          >
            <div
              style={{
                position: screenPosition,
                bottom: 0,
                width: "100%",
                minHeight: systemNavigationBarHeight,
                backgroundColor: systemNavigationBarColor
              }}
            />
          </div>
        )}
      </div>
      {sharedTopBar && (
        <div
          ref={attachSharedTopBar}
          data-flemo-bar="app"
          data-flemo-bar-id={sharedTopBarId}
          data-flemo-bar-id-type={sharedTopBarId === undefined ? undefined : typeof sharedTopBarId}
          data-flemo-router={routerId ?? undefined}
          data-flemo-bar-transition={transitionName}
          data-flemo-bar-status={status}
          data-flemo-bar-active={isActive ? "true" : "false"}
          data-flemo-bar-riding={rideTopBar ? "true" : "false"}
          data-flemo-anim-hold={holdAttr}
          style={{
            position: screenPosition,
            top: !hideStatusBar ? statusBarHeight : 0,
            left: 0,
            width: "100%"
          }}
        >
          {sharedTopBar}
        </div>
      )}
      {sharedBottomBar && (
        <div
          ref={attachSharedBottomBar}
          data-flemo-bar="nav"
          data-flemo-bar-id={sharedBottomBarId}
          data-flemo-bar-id-type={
            sharedBottomBarId === undefined ? undefined : typeof sharedBottomBarId
          }
          data-flemo-router={routerId ?? undefined}
          data-flemo-bar-transition={transitionName}
          data-flemo-bar-status={status}
          data-flemo-bar-active={isActive ? "true" : "false"}
          data-flemo-bar-riding={rideBottomBar ? "true" : "false"}
          data-flemo-anim-hold={holdAttr}
          style={{
            display: isKeyboardVisible ? "none" : undefined,
            position: screenPosition,
            bottom: !hideSystemNavigationBar ? systemNavigationBarHeight : 0,
            left: 0,
            width: "100%"
          }}
        >
          {sharedBottomBar}
        </div>
      )}
      {decorator && <ScreenDecorator ref={decoratorRef} data-flemo-anim-hold={holdAttr} />}
      {/*
        THE DIM, FOLLOWED OUT.

        A screen's decorator sits in that screen's container and covers
        everything inside it. An overlay that left the container to clear the
        shared bars leaves the dim behind with everything else it left — and
        unlike the transform, nothing about paint order brings it back.
        Measured: an inline sheet is covered by the dim, the same sheet through
        <Layer> is not.

        That is not a shade of grey. A consumer writes this decorator with
        `createDecorator` and it can be anything, opaque included, so a screen
        disappearing under its own dim while its sheet floats untouched is a
        correctness hole rather than a cosmetic one.

        So the overlay carries the dim out, the same way it carries the screen's
        flight: one copy per owner, sitting immediately above that owner's own
        slots and below any screen above it. Slots take even levels and their
        dim the odd one after, which is what keeps the pair adjacent no matter
        how many screens have overlays open.
      */}
      {decorator && hasLayerSlot && layerHostTarget
        ? createPortal(
            <ScreenDecorator data-flemo-anim-hold={holdAttr} style={{ zIndex: zIndex * 2 + 1 }} />,
            layerHostTarget
          )
        : null}
      {/*
        The <Layer> host, rendered only by the OUTERMOST screen in a chain. It
        is a sibling of the scope, and that is the entire mechanism: a
        transform binds descendants, so the screen's motion cannot reach what
        is portaled here.

        Full-size and absolute so a consumer's absolutely positioned overlay
        has the region to resolve against, and `pointer-events: none` because
        an empty host that spans the screen would otherwise swallow every tap
        meant for the screen underneath. Slots hand the pointers back to their
        own children.

        It carries no containment and no promotion of its own — either would
        re-create the containing block the overlay left the screen to escape.
        It DOES ride this screen's flight, on the same attributes a shared bar
        uses, because when this screen moves everything it hosts has to move
        with it: an overlay opened in a nested screen belongs to the region
        this screen is, and a region that slides out from under its own sheet
        is the bug this pairing exists to prevent. A slot only adds its owner's
        flight on top when the owner is a DIFFERENT screen (see
        LayerOwner.rendersHost), so the two never double up.
      */}
      {!inheritedLayerHost && (
        <div
          ref={setLayerHost}
          {...{
            [LAYER_HOST_ATTR]: "",
            [TRANSITION_ATTR]: transitionName,
            [STATUS_ATTR]: status,
            [ACTIVE_ATTR]: isActive ? "true" : "false",
            [ANIM_HOLD_ATTR]: holdAttr
          }}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: OVERLAY_LEVEL
          }}
        />
      )}
    </div>
  );
}

export default ScreenMotion;
