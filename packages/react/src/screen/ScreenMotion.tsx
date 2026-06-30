import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";

import {
  computeBarRiding,
  createSwipeController,
  createTransitionEngine,
  decoratorMap,
  transitionMap
} from "@flemo/core";

import LayerMountContext from "@screen/LayerMountContext";
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

  const currentTransition = (transitionMap.get(transitionName) ?? transitionMap.get("none"))!;
  const { initial, swipeDirection, decoratorName } = currentTransition;
  const decorator = decoratorMap.get(decoratorName!);

  const { viewportScrollHeight } = useViewportScrollHeight();

  const isKeyboardVisible = viewportScrollHeight > 0;

  const [sharedTopBarHeight, setSharedTopBarHeight] = useState(0);
  const [sharedBottomBarHeight, setSharedBottomBarHeight] = useState(0);

  // The scope-level node <Layer> portals overlays to (set via ref callback so
  // the context updates once it exists). It lives outside the content-isolation
  // box, so a portaled overlay resolves against the full-screen scope and rides
  // the transition instead of being trapped in the inset content box.
  const [layerMount, setLayerMount] = useState<HTMLDivElement | null>(null);

  // Decouple the transition START from the entering screen's content render. The
  // scope element the keyframe animates and the consumer's `{children}` commit
  // in one React render, so a heavy cold mount (lazy chunk + fetch + a large
  // DOM) delays the first paint, and thus the animation's start, until that
  // whole subtree commits. That reads as the transition arriving late and
  // colliding with the content's re-render, worst on iOS where promoting and
  // rasterizing the layer on the first animated frame is itself costly. For an
  // entering push/replace screen, paint the scope first over an EMPTY content
  // box (the keyframe starts at once, on a cheap layer), then fill the children
  // on the next, transition-priority commit. The screen is hidden by its
  // `initial` on the first frame, so the empty box is never seen. The root, SSR,
  // pop (Activity preserves this state), and no-offset ("none") paths render
  // children directly, unchanged.
  const hidesOnEnter = !!initial && Object.keys(initial).length > 0;
  const [contentReady, setContentReady] = useState(
    () => !(isActive && (status === "PUSHING" || status === "REPLACING") && hidesOnEnter)
  );
  useEffect(() => {
    if (contentReady) return;
    startTransition(() => setContentReady(true));
  }, [contentReady]);
  const content = contentReady ? children : null;

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
        isActive
      }),
    [engine, status, isActive, prevTransitionName, transitionName]
  );

  useLayoutEffect(() => {
    const element = sharedTopBarRef.current;
    if (!element) {
      setSharedTopBarHeight(0);
      return;
    }
    if (element.offsetHeight > 0) setSharedTopBarHeight(element.offsetHeight);
    const observer = new ResizeObserver(([entry]) => {
      // Ignore a measured height of 0: it happens when this screen is frozen
      // (display:none) during a transition, not because the bar shrank. Letting
      // the spacer collapse would grow the scroll area, and WebKit clamps
      // scrollTop to the smaller max and does NOT restore it on unfreeze (scroll
      // jumps up on short pages). Keep the last real height so the reserved space
      // stays stable across freeze/unfreeze.
      if (entry.contentRect.height > 0) setSharedTopBarHeight(entry.contentRect.height);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [sharedTopBar]);

  useLayoutEffect(() => {
    const element = sharedBottomBarRef.current;
    if (!element) {
      setSharedBottomBarHeight(0);
      return;
    }
    if (element.offsetHeight > 0) setSharedBottomBarHeight(element.offsetHeight);
    const observer = new ResizeObserver(([entry]) => {
      // Ignore a measured height of 0: it happens when this screen is frozen
      // (display:none) during a transition, not because the bar shrank. Letting
      // the spacer collapse would grow the scroll area, and WebKit clamps
      // scrollTop to the smaller max and does NOT restore it on unfreeze (scroll
      // jumps up on short pages). Keep the last real height so the reserved space
      // stays stable across freeze/unfreeze.
      if (entry.contentRect.height > 0) setSharedBottomBarHeight(entry.contentRect.height);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
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

  const initialStyle: { transform?: string; opacity?: string } = (() => {
    // Only the actively entering screen needs the initial style; everything
    // else either has a CSS rest rule applying (IDLE/COMPLETED) or is in the
    // middle of an animation whose keyframe `from` block already enforces the
    // entry value.
    if (!isActive) return {};
    if (status !== "PUSHING" && status !== "REPLACING") return {};
    const initialDecls: { transform?: string; opacity?: string } = {};
    if (typeof initial.x === "number") initialDecls.transform = `translateX(${initial.x}px)`;
    if (typeof initial.x === "string") initialDecls.transform = `translateX(${initial.x})`;
    if (typeof initial.y === "number") initialDecls.transform = `translateY(${initial.y}px)`;
    if (typeof initial.y === "string") initialDecls.transform = `translateY(${initial.y})`;
    if (typeof initial.opacity === "number") initialDecls.opacity = `${initial.opacity}`;
    return initialDecls;
  })();

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
            overflowY: contentScrollable ? "auto" : undefined,
            // Promote the content onto its own compositing layer for the
            // duration of any transition. The scope (`data-flemo-screen`) is the
            // element the transition's keyframe animates, and `{children}` paint
            // into it. When the content re-renders mid-transition (e.g. an async
            // fetch resolving and swapping skeleton → content), it dirties the
            // scope layer's backing store. WebKit runs the keyframe on the
            // compositor — a pure main-thread block does NOT disturb it — but a
            // repaint of the *animating layer itself* stalls that layer's
            // presentation, so the transition visibly skips ahead and lands
            // early. (Verified with a per-video-frame slit-scan: identical to a
            // clean run once isolated; abbreviated without.) Giving the content
            // its own layer means a mid-transition repaint hits THIS layer, not
            // the scope's, so the scope keeps animating smoothly and the content
            // fills in when ready — matching how Chromium already behaves.
            //
            // Transition-agnostic on purpose: it isolates the content's paint
            // regardless of which property the scope animates (translate, scale,
            // opacity, or anything a custom `createTransition` defines). Scoped
            // to the in-flight window so the extra layer is dropped at rest.
            //
            // Promote with `transform: translateZ(0)`, NOT `will-change: opacity`.
            // A backdrop-root trigger (opacity < 1, will-change: opacity, filter,
            // isolation) re-renders this subtree into an isolated group, which
            // changes how a consumer `backdrop-filter` (e.g. a frosted sticky
            // header inside the content) samples its backdrop: the blur visibly
            // washes out for the duration of the transition. A transform does not
            // establish a backdrop root, so consumer blur keeps rendering. The
            // WebKit isolation is statistically identical to `will-change: opacity`
            // (slit-scan).
            //
            // A transform also makes this box a containing block for `position:
            // fixed` descendants, so an overlay rendered INSIDE the scrolling
            // body (an inline bottom sheet) would re-parent into this
            // *content-height* box for the in-flight window and a closed sheet
            // could flash. That's the structural escape <Layer> provides: it
            // portals such overlays up to the scope level (outside this box), so
            // they resolve against the full-screen scope and ride the transition.
            // This is the trilemma resolved — backdrop keeps working here (a
            // transform is not a backdrop root) AND overlays escape via <Layer>.
            ...(status !== "IDLE" && status !== "COMPLETED"
              ? { transform: "translateZ(0)", willChange: "transform" }
              : null)
          }}
        >
          <LayerMountContext.Provider value={layerMount}>{content}</LayerMountContext.Provider>
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
        {/* <Layer> overlays portal here: scope level, outside the isolation box,
            after the content so they stack above it. */}
        <div ref={setLayerMount} data-flemo-layer-mount />
      </div>
      {sharedTopBar && (
        <div
          ref={sharedTopBarRef}
          data-flemo-bar="app"
          data-flemo-bar-transition={transitionName}
          data-flemo-bar-status={status}
          data-flemo-bar-active={isActive ? "true" : "false"}
          data-flemo-bar-riding={rideTopBar ? "true" : "false"}
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
      {decorator && <ScreenDecorator ref={decoratorRef} />}
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
