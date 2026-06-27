import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";

import {
  createSwipeController,
  createTransitionEngine,
  decoratorMap,
  driveBarRiding,
  transitionMap
} from "@flemo/core";

import type { ScreenProps } from "@screen/Screen";
import ScreenDecorator from "@screen/ScreenDecorator";

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
  sharedAppBar,
  sharedNavigationBar,
  appBar,
  navigationBar,
  hideStatusBar,
  hideSystemNavigationBar,
  backgroundColor = "white",
  contentScrollable = true,
  ...props
}: ScreenProps) {
  const { id, isActive, isRoot, zIndex, transitionName, prevTransitionName } = useScreen();

  const stores = useStores();

  const status = useNavigateStore((state) => state.status);
  const dragStatus = useScreenStore((state) => state.dragStatus);
  const setDragStatus = stores.screen.getState().setDragStatus;
  const setReplaceTransitionStatus = stores.screen.getState().setReplaceTransitionStatus;
  const index = useHistoryStore((state) => state.index);

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

  const [sharedAppBarHeight, setSharedAppBarHeight] = useState(0);
  const [sharedNavigationBarHeight, setSharedNavigationBarHeight] = useState(0);

  const screenRef = useRef<HTMLDivElement | null>(null);
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const decoratorRef = useRef<HTMLDivElement | null>(null);
  const sharedAppBarRef = useRef<HTMLDivElement | null>(null);
  const sharedNavigationBarRef = useRef<HTMLDivElement | null>(null);

  // Framework-neutral swipe-back controller, stable for this screen's lifetime.
  // It holds the gesture state and drives the transition/decorator swipe
  // callbacks. Live render values it needs are mirrored into `swipeEnvRef`
  // each render (a "latest ref"), so the controller's stable getters always
  // read current state; element refs are read live via `.current`.
  const swipeEnvRef = useRef({
    transition: currentTransition,
    decorator,
    hasSharedAppBar: !!sharedAppBar,
    hasSharedNavigationBar: !!sharedNavigationBar,
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
    hasSharedAppBar: !!sharedAppBar,
    hasSharedNavigationBar: !!sharedNavigationBar,
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
        sharedAppBar: sharedAppBarRef.current,
        sharedNavigationBar: sharedNavigationBarRef.current
      }),
      hasSharedAppBar: () => swipeEnvRef.current.hasSharedAppBar,
      hasSharedNavigationBar: () => swipeEnvRef.current.hasSharedNavigationBar,
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
          bars: [sharedAppBarRef.current, sharedNavigationBarRef.current]
        }),
        transitionName,
        prevTransitionName,
        status,
        isActive
      }),
    [engine, status, isActive, prevTransitionName, transitionName]
  );

  useLayoutEffect(() => {
    const element = sharedAppBarRef.current;
    if (!element) {
      setSharedAppBarHeight(0);
      return;
    }
    if (element.offsetHeight > 0) setSharedAppBarHeight(element.offsetHeight);
    const observer = new ResizeObserver(([entry]) => {
      // Ignore a measured height of 0: it happens when this screen is frozen
      // (display:none) during a transition, not because the bar shrank. Letting
      // the spacer collapse would grow the scroll area, and WebKit clamps
      // scrollTop to the smaller max and does NOT restore it on unfreeze (scroll
      // jumps up on short pages). Keep the last real height so the reserved space
      // stays stable across freeze/unfreeze.
      if (entry.contentRect.height > 0) setSharedAppBarHeight(entry.contentRect.height);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [sharedAppBar]);

  useLayoutEffect(() => {
    const element = sharedNavigationBarRef.current;
    if (!element) {
      setSharedNavigationBarHeight(0);
      return;
    }
    if (element.offsetHeight > 0) setSharedNavigationBarHeight(element.offsetHeight);
    const observer = new ResizeObserver(([entry]) => {
      // Ignore a measured height of 0: it happens when this screen is frozen
      // (display:none) during a transition, not because the bar shrank. Letting
      // the spacer collapse would grow the scroll area, and WebKit clamps
      // scrollTop to the smaller max and does NOT restore it on unfreeze (scroll
      // jumps up on short pages). Keep the last real height so the reserved space
      // stays stable across freeze/unfreeze.
      if (entry.contentRect.height > 0) setSharedNavigationBarHeight(entry.contentRect.height);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [sharedNavigationBar]);

  // Register this screen's shared-bar presence so other screens can read it.
  useLayoutEffect(() => {
    const { registerSharedBars, unregisterSharedBars } = stores.screen.getState();
    registerSharedBars(id, {
      appBar: !!sharedAppBar,
      navigationBar: !!sharedNavigationBar
    });
    return () => unregisterSharedBars(id);
  }, [id, sharedAppBar, sharedNavigationBar, stores.screen]);

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
  //    with the same `@keyframes` the screen uses. We set the bar's data-
  //    attributes here and toggle `data-flemo-bar-riding` based on partner
  //    ownership. The compositor drives both elements off one keyframe. No
  //    JS frame in the loop, no main-thread style read/write per frame.
  // 2. Swipe drag. Handled synchronously inside the core swipe controller,
  //    which mirrors every `animate(currentScreen, ...)` call to the riding
  //    bars in the SAME JS tick. No rAF loop, no `getComputedStyle` reads.
  //    The bars and the screen commit in the same paint pass.
  const isTopOrTopPrev = isActive || zIndex === index - 1;
  const hasSharedAppBar = !!sharedAppBar;
  const hasSharedNavigationBar = !!sharedNavigationBar;

  // (1) Toggle `data-flemo-bar-riding` on each bar based on partner ownership.
  // `useLayoutEffect` so the attribute is set before the first transition frame
  // paints; the core controller owns the toggle + re-subscription logic and
  // stays framework-neutral (plain DOM + injected store reads).
  useLayoutEffect(
    () =>
      driveBarRiding({
        appBar: sharedAppBarRef.current,
        navBar: sharedNavigationBarRef.current,
        isTopOrTopPrev,
        isActive,
        index,
        hasAppBar: hasSharedAppBar,
        hasNavBar: hasSharedNavigationBar,
        getStatus: () => stores.navigate.getState().status,
        getHistories: () => stores.history.getState().histories,
        getSharedBars: () => stores.screen.getState().sharedBars,
        subscribeStatus: (listener) => stores.navigate.subscribe(listener),
        subscribeSharedBars: (listener) => stores.screen.subscribe(listener)
      }),
    [
      isTopOrTopPrev,
      isActive,
      index,
      hasSharedAppBar,
      hasSharedNavigationBar,
      stores.history,
      stores.navigate,
      stores.screen
    ]
  );

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
        position: "fixed",
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
          position: "fixed",
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
                position: "fixed",
                top: 0,
                width: "100%",
                minHeight: statusBarHeight,
                backgroundColor: statusBarColor
              }}
            />
          </div>
        )}
        {sharedAppBar && (
          <div
            style={{
              width: "100%",
              minHeight: sharedAppBarHeight
            }}
          />
        )}
        {appBar}
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
            // to the in-flight window so the extra layer is dropped at rest, and
            // it adds no containing block beyond the one the scope's own
            // transform already establishes while animating.
            ...(status !== "IDLE" && status !== "COMPLETED"
              ? { transform: "translateZ(0)", willChange: "transform" }
              : null)
          }}
        >
          {children}
        </div>
        {navigationBar}
        {sharedNavigationBar && (
          <div
            style={{
              display: isKeyboardVisible ? "none" : undefined,
              width: "100%",
              minHeight: sharedNavigationBarHeight
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
                position: "fixed",
                bottom: 0,
                width: "100%",
                minHeight: systemNavigationBarHeight,
                backgroundColor: systemNavigationBarColor
              }}
            />
          </div>
        )}
      </div>
      {sharedAppBar && (
        <div
          ref={sharedAppBarRef}
          data-flemo-bar="app"
          data-flemo-bar-transition={transitionName}
          data-flemo-bar-status={status}
          data-flemo-bar-active={isActive ? "true" : "false"}
          style={{
            position: "fixed",
            top: !hideStatusBar ? statusBarHeight : 0,
            left: 0,
            width: "100%",
            zIndex: 1
          }}
        >
          {sharedAppBar}
        </div>
      )}
      {sharedNavigationBar && (
        <div
          ref={sharedNavigationBarRef}
          data-flemo-bar="nav"
          data-flemo-bar-transition={transitionName}
          data-flemo-bar-status={status}
          data-flemo-bar-active={isActive ? "true" : "false"}
          style={{
            display: isKeyboardVisible ? "none" : undefined,
            position: "fixed",
            bottom: !hideSystemNavigationBar ? systemNavigationBarHeight : 0,
            left: 0,
            width: "100%",
            zIndex: 1
          }}
        >
          {sharedNavigationBar}
        </div>
      )}
      {decorator && <ScreenDecorator ref={decoratorRef} />}
      <div
        data-swipe-at-edge-bar
        style={{
          position: "fixed",
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
