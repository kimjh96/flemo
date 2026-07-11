import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";

import {
  animHoldKey,
  computeBarRiding,
  eagerlyDecodeImages,
  isOpaqueColor,
  createSwipeController,
  createTransitionEngine,
  decoratorMap,
  enteringInitialStyle,
  observeBarHeight,
  resolveTransition,
  scheduleAnimHoldRelease
} from "@flemo/core";

import type { ScreenProps } from "@screen/Screen";
import ScreenDecorator from "@screen/ScreenDecorator";

import { useScreenViewport } from "@screen/ScreenViewportContext";
import useScreen from "@screen/useScreen";

import useViewportScrollHeight from "@screen/useViewportScrollHeight";

import useHistoryStore from "@stores/useHistoryStore";
import useNavigateStore from "@stores/useNavigateStore";
import useScreenStore from "@stores/useScreenStore";
import useStores from "@stores/useStores";

function ScreenMotion({
  children,
  statusBarHeight,
  statusBarColor,
  systemNavigationBarHeight,
  systemNavigationBarColor,
  sharedTopBar,
  sharedBottomBar,
  topBar,
  bottomBar,
  hideStatusBar,
  hideSystemNavigationBar,
  backgroundColor = "white",
  contentScrollable = true,
  ...props
}: ScreenProps) {
  const { id, isActive, isRoot, zIndex, transitionName, prevTransitionName } = useScreen();

  // A root <Router> renders screens fixed to the viewport; a nested <Router>
  // (a transition region inside a persistent layout) contains them, so the
  // screen container and its viewport-level chrome anchor to the region via
  // `position: absolute` instead.
  const { contained } = useScreenViewport();
  const screenPosition = contained ? "absolute" : "fixed";

  const stores = useStores();

  const status = useNavigateStore((state) => state.status);
  const dragStatus = useScreenStore((state) => state.dragStatus);
  const setDragStatus = stores.screen.getState().setDragStatus;
  const setReplaceTransitionStatus = stores.screen.getState().setReplaceTransitionStatus;
  const index = useHistoryStore((state) => state.index);
  const histories = useHistoryStore((state) => state.histories);

  // The partner screen this one would hand its shared bars to (the active top
  // looks one below; a prev looks at the top). Subscribe to JUST that entry so
  // bar-riding recomputes when the partner registers/unregisters its bars,
  // without re-rendering on unrelated screens' bars.
  const partnerId = isActive ? histories[index - 1]?.id : histories[index]?.id;
  const partnerBars = useScreenStore((state) =>
    partnerId ? state.sharedBars[partnerId] : undefined
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

  const currentTransition = resolveTransition(transitionName);
  const { initial, swipeDirection, decoratorName } = currentTransition;
  const decorator = decoratorMap.get(decoratorName!);

  const { viewportScrollHeight } = useViewportScrollHeight();

  const isKeyboardVisible = viewportScrollHeight > 0;

  const [sharedTopBarHeight, setSharedTopBarHeight] = useState(0);
  const [sharedBottomBarHeight, setSharedBottomBarHeight] = useState(0);

  const screenRef = useRef<HTMLDivElement | null>(null);
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const decoratorRef = useRef<HTMLDivElement | null>(null);
  const sharedTopBarRef = useRef<HTMLDivElement | null>(null);
  const sharedBottomBarRef = useRef<HTMLDivElement | null>(null);

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
    viewportScrollHeight,
    isRoot,
    isActive,
    status,
    dragStatus,
    index
  };

  const swipeControllerRef = useRef<ReturnType<typeof createSwipeController> | null>(null);
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
      setDragStatus,
      back: () => window.history.back()
    });
  }
  const swipeController = swipeControllerRef.current;

  const handlePointerDown = (event: ReactPointerEvent) =>
    swipeController.pointerDown(event.nativeEvent);
  const handlePointerMove = (event: ReactPointerEvent) =>
    swipeController.pointerMove(event.nativeEvent);
  const handlePointerUp = (event: ReactPointerEvent) =>
    swipeController.pointerUp(event.nativeEvent);

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

      if ((event.target as HTMLElement)?.dataset.swipeAtEdgeBar === "true") {
        event.preventDefault();
      }
    };

    scope.addEventListener("touchmove", handleTouchMove, {
      passive: false
    });

    return () => {
      scope.removeEventListener("touchmove", handleTouchMove);
    };
  }, [swipeController]);

  // Bar-height tracking (incl. the ignore-0-while-frozen WebKit gotcha) lives
  // in @flemo/core's observeBarHeight; this binding only stores the height.
  useLayoutEffect(() => {
    const element = sharedTopBarRef.current;
    if (!element) {
      setSharedTopBarHeight(0);
      return;
    }
    return observeBarHeight(element, setSharedTopBarHeight);
  }, [sharedTopBar]);

  useLayoutEffect(() => {
    const element = sharedBottomBarRef.current;
    if (!element) {
      setSharedBottomBarHeight(0);
      return;
    }
    return observeBarHeight(element, setSharedBottomBarHeight);
  }, [sharedBottomBar]);

  // Register this screen's shared-bar presence so other screens can read it.
  useLayoutEffect(() => {
    const { registerSharedBars, unregisterSharedBars } = stores.screen.getState();
    registerSharedBars(id, {
      topBar: !!sharedTopBar,
      bottomBar: !!sharedBottomBar
    });
    return () => unregisterSharedBars(id);
  }, [id, sharedTopBar, sharedBottomBar, stores.screen]);

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
  const isTopOrTopPrev = isActive || zIndex === index - 1;
  const hasSharedTopBar = !!sharedTopBar;
  const hasSharedBottomBar = !!sharedBottomBar;

  const { app: rideTopBar, nav: rideBottomBar } = computeBarRiding({
    status,
    isTopOrTopPrev,
    hasTopBar: hasSharedTopBar,
    hasNavBar: hasSharedBottomBar,
    partnerBars
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
  // layers. The decision (`animHoldKey`) and release scheduling
  // (`scheduleAnimHoldRelease`, double-rAF + backstop) live in @flemo/core so
  // other bindings anchor identically; this binding's own part is flipping the
  // flag ON in the SAME render that changes the status attribute — computed in
  // render, not an effect — so an Activity-unfrozen screen (whose effects
  // reconnect as follow-up work) still holds from its very first frame.
  const holdKey = animHoldKey({ status, isTopOrTopPrev, transitionName });
  const [animRelease, setAnimRelease] = useState<{ key: string | null; released: boolean }>({
    key: holdKey,
    released: holdKey === null
  });
  if (animRelease.key !== holdKey) {
    // Render-phase adjustment: React re-runs this component with the new state
    // before committing, so the hold and status attributes always land in the
    // same paint.
    setAnimRelease({ key: holdKey, released: holdKey === null });
  }
  const animHold = holdKey !== null && animRelease.key === holdKey && !animRelease.released;

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
    ? "false"
    : !isActive && partnerSurface?.opaqueBackground
      ? "park"
      : isActive &&
          (status === "PUSHING" || status === "REPLACING") &&
          partnerSurface?.opaqueBackground
        ? "park-under"
        : "true";

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
          bars: [sharedTopBarRef.current, sharedBottomBarRef.current]
        }),
        transitionName,
        prevTransitionName,
        status,
        isActive,
        // The rAF player starts exactly at hold release; the compiled
        // hold/park rules own every frame before it. Included in the deps so
        // the release re-runs this effect and hands the motion to the player.
        animHoldReleased: !animHold
      }),
    [engine, status, isActive, prevTransitionName, transitionName, animHold]
  );

  useEffect(() => {
    if (!animHold) return undefined;
    return scheduleAnimHoldRelease(
      () =>
        setAnimRelease((current) =>
          current.key === holdKey && !current.released ? { key: holdKey, released: true } : current
        ),
      {
        // Decode-wait: a frozen screen's discarded image bitmaps re-decode
        // during the hold instead of dropping the first animated frames.
        // (This wiring was accidentally dropped in a refactor and shipped
        // dormant — the core option existed but never received the scope.)
        scope: scopeRef.current
      }
    );
  }, [animHold, holdKey, holdAttr]);

  const initialStyle =
    holdAttr === "park-under"
      ? // The compiled park-under rule holds this screen at its DESTINATION
        // beneath the previous screen so its tiles pre-rasterize; the inline
        // entering style (the hidden `from`) would override that stylesheet
        // rule and defeat the park. On release the attribute drops, this
        // inline style returns in the same commit, and the animation replays
        // from its own `from` keyframe over the already-rasterized layer.
        {}
      : enteringInitialStyle({ initial, isActive, status });

  return (
    <div
      ref={screenRef}
      style={{
        position: screenPosition,
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        // Sibling screens stack by DOM order (no z-index) — the newest screen
        // naturally paints on top. During park-under the ENTERING screen must
        // sink BENEATH the previous screen while its destination tiles
        // pre-rasterize, and that stacking decision lives HERE on the outer
        // container: a z-index on the inner scope only reorders within this
        // box and leaks the park (a full-screen flash of the next screen).
        zIndex: holdAttr === "park-under" ? -1 : undefined,
        // `contain: layout style` keeps layout/style scoped without `paint`,
        // which would make this element the containing block for `position:
        // fixed` descendants and trap consumer overlays (e.g. bottom sheets)
        // inside the screen.
        contain: "layout style",
        flexDirection: "column",
        boxSizing: "border-box",
        overscrollBehavior: "contain"
      }}
    >
      <div
        data-swipe-at-edge-bar
        style={{
          position: screenPosition,
          top: 0,
          left: 0,
          width: 8,
          height: "100%",
          zIndex: 1
        }}
      />
      <div
        ref={scopeRef}
        {...props}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        data-flemo-screen
        data-flemo-transition={transitionName}
        data-flemo-status={status}
        data-flemo-active={isActive ? "true" : "false"}
        data-flemo-anim-hold={holdAttr}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          backgroundColor,
          overflowY: contentScrollable ? undefined : "auto",
          touchAction: swipeDirection === "x" ? "pan-y" : swipeDirection === "y" ? "pan-x" : "auto",
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
            // No compositing-layer promotion here anymore. The translateZ(0)
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
          {children}
        </div>
        {bottomBar}
        {sharedBottomBar && (
          <div
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
          ref={sharedTopBarRef}
          data-flemo-bar="app"
          data-flemo-bar-transition={transitionName}
          data-flemo-bar-status={status}
          data-flemo-bar-active={isActive ? "true" : "false"}
          data-flemo-bar-riding={rideTopBar ? "true" : "false"}
          data-flemo-anim-hold={holdAttr}
          style={{
            position: screenPosition,
            top: !hideStatusBar ? statusBarHeight : 0,
            left: 0,
            width: "100%",
            zIndex: 1
          }}
        >
          {sharedTopBar}
        </div>
      )}
      {sharedBottomBar && (
        <div
          ref={sharedBottomBarRef}
          data-flemo-bar="nav"
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
            width: "100%",
            zIndex: 1
          }}
        >
          {sharedBottomBar}
        </div>
      )}
      {decorator && <ScreenDecorator ref={decoratorRef} data-flemo-anim-hold={holdAttr} />}
      <div
        data-swipe-at-edge-bar
        style={{
          position: screenPosition,
          top: 0,
          right: 0,
          width: 8,
          height: "100%",
          zIndex: 1
        }}
      />
    </div>
  );
}

export default ScreenMotion;
